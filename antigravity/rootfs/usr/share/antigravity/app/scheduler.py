"""Dynamic & Adaptive Polling Scheduler for Google Antigravity."""

from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timedelta, timezone
from typing import Dict, List, Optional

from .fetcher import AntigravityFetcher
from .models import (
    AccountConfig,
    AccountQuota,
    SchedulerState,
    SystemStatus,
)

_LOGGER = logging.getLogger(__name__)

# Constants for Adaptive Polling
ACTIVITY_WINDOW_SECONDS = 900  # 15 minutes
IDLE_THRESHOLD_SECONDS = 7200  # 2 hours


class DynamicScheduler:
    """Manages scheduled polling with adaptive frequency and multi-account support."""

    def __init__(
        self,
        accounts: List[AccountConfig],
        base_interval: int = 1800,
        adaptive_polling: bool = True,
        fast_interval: int = 180,
        idle_interval: int = 3600,
        version: str = "1.0.0",
    ) -> None:
        self.accounts = accounts
        self.base_interval = max(30, base_interval)
        self.adaptive_polling = adaptive_polling
        self.fast_interval = max(30, fast_interval)
        self.idle_interval = max(base_interval, idle_interval)
        self.version = version

        self.fetcher = AntigravityFetcher()
        self._accounts_data: Dict[str, AccountQuota] = {}
        self._lock = asyncio.Lock()
        self._task: Optional[asyncio.Task] = None
        self._running = False
        self._wake_event = asyncio.Event()

        # State tracking
        self.last_polled_at: Optional[datetime] = None
        self.last_change_at: Optional[datetime] = None
        self.next_poll_at: Optional[datetime] = None
        self.current_interval: int = self.base_interval
        self.is_fast_polling: bool = False
        self.recent_activity: bool = False

    def update_accounts(self, accounts: List[AccountConfig]) -> None:
        """Update configured accounts."""
        self.accounts = accounts

    async def start(self) -> None:
        """Start the background polling loop."""
        if self._running:
            return
        self._running = True
        # Perform initial fetch immediately
        await self.poll_all_accounts(is_manual=False)
        self._task = asyncio.create_task(self._run_loop())
        _LOGGER.info("Antigravity Dynamic Scheduler started successfully.")

    async def stop(self) -> None:
        """Stop the background polling loop."""
        self._running = False
        self._wake_event.set()
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
            self._task = None
        _LOGGER.info("Antigravity Dynamic Scheduler stopped.")

    async def _run_loop(self) -> None:
        """Main scheduler loop."""
        while self._running:
            # Determine next interval based on adaptive algorithm
            self._recalculate_interval()
            now = datetime.now(timezone.utc)
            self.next_poll_at = now + timedelta(seconds=self.current_interval)

            _LOGGER.debug(
                "Next poll scheduled in %ds (Mode: %s)",
                self.current_interval,
                (
                    "FAST (3m)"
                    if self.is_fast_polling
                    else "IDLE (60m)" if self.current_interval >= self.idle_interval else "BASE (30m)"
                ),
            )

            try:
                # Wait for interval or immediate wake event
                self._wake_event.clear()
                await asyncio.wait_for(self._wake_event.wait(), timeout=self.current_interval)
            except asyncio.TimeoutError:
                pass  # Timer expired naturally, time to poll
            except asyncio.CancelledError:
                break

            if not self._running:
                break

            # Execute scheduled poll
            await self.poll_all_accounts(is_manual=False)

    def _recalculate_interval(self) -> None:
        """Calculate dynamic interval based on recent activity."""
        if not self.adaptive_polling:
            self.current_interval = self.base_interval
            self.is_fast_polling = False
            self.recent_activity = False
            return

        now = datetime.now(timezone.utc)
        if self.last_change_at is None:
            # Default to base interval if no changes recorded yet
            self.current_interval = self.base_interval
            self.is_fast_polling = False
            self.recent_activity = False
            return

        elapsed_since_change = (now - self.last_change_at).total_seconds()

        if elapsed_since_change <= ACTIVITY_WINDOW_SECONDS:
            # Usage/delta detected in last 15 minutes -> Fast poll
            self.current_interval = self.fast_interval
            self.is_fast_polling = True
            self.recent_activity = True
        elif elapsed_since_change >= IDLE_THRESHOLD_SECONDS:
            # Unchanged for > 2 hours -> Back off
            self.current_interval = self.idle_interval
            self.is_fast_polling = False
            self.recent_activity = False
        else:
            # Standard base interval
            self.current_interval = self.base_interval
            self.is_fast_polling = False
            self.recent_activity = False

    async def poll_all_accounts(self, is_manual: bool = False) -> None:
        """Fetch quota data for all configured accounts."""
        async with self._lock:
            now = datetime.now(timezone.utc)
            self.last_polled_at = now
            any_changed = False

            # If no accounts configured, initialize one default demo account
            accounts_to_poll = self.accounts if self.accounts else [AccountConfig(name="Primary Account")]

            for acc in accounts_to_poll:
                prev_quota = self._accounts_data.get(acc.name)
                try:
                    quota, changed = await self.fetcher.fetch_quota(acc, prev_quota)
                    self._accounts_data[acc.name] = quota
                    if changed:
                        any_changed = True
                except Exception as ex:
                    _LOGGER.error("Error fetching quota for account '%s': %s", acc.name, ex)

            if any_changed or self.last_change_at is None:
                self.last_change_at = now
                _LOGGER.info("Quota changes detected. Activity timestamp updated.")

            self._recalculate_interval()
            self.next_poll_at = now + timedelta(seconds=self.current_interval)

    async def force_refresh(self, account_name: Optional[str] = None) -> SystemStatus:
        """Trigger an immediate manual refresh."""
        _LOGGER.info("Manual force refresh requested (target: %s)", account_name or "ALL")
        if account_name:
            acc = next((a for a in self.accounts if a.name == account_name), None)
            if acc:
                async with self._lock:
                    prev = self._accounts_data.get(acc.name)
                    quota, changed = await self.fetcher.fetch_quota(acc, prev)
                    self._accounts_data[acc.name] = quota
                    now = datetime.now(timezone.utc)
                    self.last_polled_at = now
                    if changed or self.last_change_at is None:
                        self.last_change_at = now
        else:
            await self.poll_all_accounts(is_manual=True)

        # Signal scheduler loop to wake up and reset interval timers
        self._wake_event.set()
        return self.get_system_status()

    def get_system_status(self) -> SystemStatus:
        """Get aggregated system and quota status."""
        now = datetime.now(timezone.utc)
        accounts_list = list(self._accounts_data.values())
        active_name = accounts_list[0].account_name if accounts_list else ""

        # Calculate remaining seconds until next poll
        if self.next_poll_at:
            rem_sec = max(0, int((self.next_poll_at - now).total_seconds()))
        else:
            rem_sec = self.current_interval

        scheduler_state = SchedulerState(
            base_interval=self.base_interval,
            current_interval=self.current_interval,
            fast_interval=self.fast_interval,
            idle_interval=self.idle_interval,
            is_adaptive=self.adaptive_polling,
            is_fast_polling=self.is_fast_polling,
            last_polled_at=self.last_polled_at.isoformat() if self.last_polled_at else None,
            next_poll_at=self.next_poll_at.isoformat() if self.next_poll_at else None,
            seconds_until_next_poll=rem_sec,
            recent_activity_detected=self.recent_activity,
            last_change_at=self.last_change_at.isoformat() if self.last_change_at else None,
        )

        overall_status = "online"
        if any(acc.status == "error" for acc in accounts_list):
            overall_status = "degraded"

        return SystemStatus(
            version=self.version,
            status=overall_status,
            accounts_count=len(accounts_list),
            active_account=active_name,
            accounts=accounts_list,
            scheduler=scheduler_state,
        )

    def get_account_quota(self, name: str) -> Optional[AccountQuota]:
        """Get quota for a specific account name."""
        return self._accounts_data.get(name)
