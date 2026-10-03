"""Unit tests for scheduler in Google Antigravity Addon."""

import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest

# Add rootfs/usr/share/antigravity to sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "rootfs" / "usr" / "share" / "antigravity"))

from app.models import AccountConfig
from app.scheduler import DynamicScheduler


@pytest.mark.asyncio
async def test_scheduler_initialization_and_poll():
    """Test scheduler initialization and polling accounts."""
    accounts = [
        AccountConfig(name="Acc1", refresh_token=""),
        AccountConfig(name="Acc2", refresh_token=""),
    ]
    scheduler = DynamicScheduler(
        accounts=accounts,
        base_interval=1800,
        adaptive_polling=True,
        fast_interval=180,
        idle_interval=3600,
    )

    await scheduler.poll_all_accounts(is_manual=False)
    status = scheduler.get_system_status()

    assert status.accounts_count == 2
    assert status.scheduler.base_interval == 1800
    assert scheduler.get_account_quota("Acc1") is not None
    assert scheduler.get_account_quota("Acc2") is not None


def test_scheduler_adaptive_recalculation():
    """Test adaptive interval recalculation based on activity timestamp."""
    accounts = [AccountConfig(name="Acc1")]
    scheduler = DynamicScheduler(
        accounts=accounts,
        base_interval=1800,
        adaptive_polling=True,
        fast_interval=180,
        idle_interval=3600,
    )

    now = datetime.now(timezone.utc)

    # 1. Activity within last 5 minutes -> Fast Polling (180s)
    scheduler.last_change_at = now - timedelta(minutes=5)
    scheduler._recalculate_interval()
    assert scheduler.current_interval == 180
    assert scheduler.is_fast_polling is True
    assert scheduler.recent_activity is True

    # 2. Activity 30 minutes ago -> Base Polling (1800s)
    scheduler.last_change_at = now - timedelta(minutes=30)
    scheduler._recalculate_interval()
    assert scheduler.current_interval == 1800
    assert scheduler.is_fast_polling is False
    assert scheduler.recent_activity is False

    # 3. Activity 3 hours ago -> Idle Backoff (3600s)
    scheduler.last_change_at = now - timedelta(hours=3)
    scheduler._recalculate_interval()
    assert scheduler.current_interval == 3600
    assert scheduler.is_fast_polling is False


@pytest.mark.asyncio
async def test_scheduler_force_refresh():
    """Test manual force refresh."""
    accounts = [AccountConfig(name="Acc1")]
    scheduler = DynamicScheduler(accounts=accounts)

    status = await scheduler.force_refresh()
    assert status.status in ("online", "degraded")
    assert status.scheduler.last_polled_at is not None
