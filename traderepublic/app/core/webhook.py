"""Outbound webhook dispatcher for Trade Republic events (orders, dividends, price triggers)."""

import asyncio
import logging
import os
import time
from typing import Any, Dict, List, Optional, Set

import aiohttp

_LOGGER = logging.getLogger(__name__)


class TRWebhookDispatcher:
    """Asynchronously dispatches high-signal Trade Republic events to a configured webhook endpoint."""

    def __init__(
        self,
        url: Optional[str] = None,
        token: Optional[str] = None,
        enabled: Optional[bool] = None,
    ) -> None:
        self.enabled: bool = (
            enabled if enabled is not None else os.getenv("WEBHOOK_ENABLED", "false").lower() in ("true", "1", "yes")
        )
        self.url: str = url or os.getenv("WEBHOOK_URL", "").strip()
        self.token: str = token or os.getenv("WEBHOOK_TOKEN", "").strip()

        self._seen_tx_ids: Set[str] = set()
        self._initialized: bool = False
        self._last_prices: Dict[str, float] = {}
        self._session: Optional[aiohttp.ClientSession] = None

    async def _get_session(self) -> aiohttp.ClientSession:
        if self._session is None or self._session.closed:
            self._session = aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=8))
        return self._session

    async def close(self) -> None:
        if self._session and not self._session.closed:
            await self._session.close()

    async def send_event(self, event_type: str, item_data: Dict[str, Any]) -> bool:
        """Post event payload to webhook URL."""
        if not self.enabled or not self.url:
            return False

        payload = {
            "event": event_type,
            "source": "traderepublic",
            "timestamp": time.time(),
            "item": item_data,
        }
        headers = {"Content-Type": "application/json"}
        if self.token:
            headers["Authorization"] = f"Bearer {self.token}"
            headers["X-Webhook-Token"] = self.token

        try:
            session = await self._get_session()
            async with session.post(self.url, json=payload, headers=headers) as resp:
                if resp.status in (200, 201, 202, 204):
                    _LOGGER.info("TR Webhook: successfully dispatched '%s' event (status %d)", event_type, resp.status)
                    return True
                _LOGGER.warning("TR Webhook: endpoint returned status %d for event '%s'", resp.status, event_type)
                return False
        except Exception as exc:
            _LOGGER.debug("TR Webhook: failed dispatching '%s': %s", event_type, exc)
            return False

    async def handle_timeline_update(self, items: List[Dict[str, Any]]) -> None:
        """Process incoming timeline stream. Dispatches events for new orders, dividends, and executions."""
        if not items:
            return

        # First run: seed seen set with current items without triggering historical notifications
        if not self._initialized:
            for item in items:
                item_id = item.get("id") or f"{item.get('title')}_{item.get('timestamp')}"
                if item_id:
                    self._seen_tx_ids.add(str(item_id))
            self._initialized = True
            _LOGGER.debug("TR Webhook: timeline watcher initialized with %d seen events", len(self._seen_tx_ids))
            return

        for item in items:
            item_id = str(item.get("id") or f"{item.get('title')}_{item.get('timestamp')}")
            if not item_id or item_id in self._seen_tx_ids:
                continue

            self._seen_tx_ids.add(item_id)
            # Bound seen set size to prevent memory leaks over weeks
            if len(self._seen_tx_ids) > 600:
                self._seen_tx_ids = set(list(self._seen_tx_ids)[-300:])

            title = str(item.get("title", "")).strip()
            subtitle = str(item.get("subtitle", "")).strip()
            body_text = f"{title} {subtitle}".lower()

            amount_val = 0.0
            amount_obj = item.get("amount")
            if isinstance(amount_obj, dict):
                try:
                    amount_val = float(amount_obj.get("value") or 0.0)
                except (ValueError, TypeError):
                    amount_val = 0.0
            elif isinstance(amount_obj, (int, float)):
                amount_val = float(amount_obj)

            clean_item = {
                "id": item_id,
                "title": title,
                "subtitle": subtitle,
                "amount": amount_val,
                "timestamp": item.get("timestamp"),
            }

            if any(k in body_text for k in ("dividende", "dividend", "ausschüttung", "zinsen", "tax refund")):
                event = "dividend_payout"
            elif any(k in body_text for k in ("order ausgeführt", "limit-order", "kauf", "verkauf", "ausführung")):
                event = "order_executed"
            elif "sparplan" in body_text:
                event = "savings_plan_executed"
            else:
                event = "timeline_event"

            _LOGGER.info(
                "TR Webhook: new timeline item detected [%s]: %s - %s (%.2f €)", event, title, subtitle, amount_val
            )
            asyncio.create_task(self.send_event(event, clean_item))

    async def check_price_threshold(
        self, isin: str, name: str, current_price: float, threshold_pct: float = 5.0
    ) -> None:
        """Check for significant price movements (>= threshold_pct) and dispatch alert."""
        if not isin or current_price <= 0.0:
            return

        last_price = self._last_prices.get(isin)
        self._last_prices[isin] = current_price

        if last_price is None or last_price <= 0.0:
            return

        change_pct = ((current_price - last_price) / last_price) * 100.0
        if abs(change_pct) >= threshold_pct:
            alert_data = {
                "isin": isin,
                "title": name or isin,
                "price": current_price,
                "previous_price": last_price,
                "change_pct": round(change_pct, 2),
                "subtitle": f"Kursänderung um {change_pct:+.2f}% gegenüber letztem Ticker ({last_price:.2f} € -> {current_price:.2f} €)",
            }
            _LOGGER.info("TR Webhook: price threshold reached for %s: %+.2f%%", isin, change_pct)
            asyncio.create_task(self.send_event("price_threshold", alert_data))
