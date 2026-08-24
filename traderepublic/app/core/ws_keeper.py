"""Persistent WebSocket connection keeper for Trade Republic.

Maintains a single long-lived authenticated WebSocket connection to
wss://api.traderepublic.com — exactly the approach used by pytr and tr-api.

Instead of opening a new connection every 5 minutes to "verify" the token
(which TR detects as a bot pattern and invalidates the session),
we keep ONE connection alive permanently with a lightweight subscription.
"""

import asyncio
import json
import logging
import ssl
from typing import Any, Callable, Optional

import websockets

from .constants import USER_AGENT

_LOGGER = logging.getLogger(__name__)

_TR_WS_URL = "wss://api.traderepublic.com"
_HANDSHAKE_PAYLOAD = {
    "locale": "de",
    "platformId": "web",
    "appVersion": "4.120.0",
    "osVersion": "10.0.0",
}
_USER_AGENT = USER_AGENT

# Keepalive heartbeat interval — send lightweight echo/ping every 60 s to prevent idle timeout
_HEARTBEAT_INTERVAL = 60

# Data refresh interval for active categories (5 minutes) — prevents TR rate limits while keeping data fresh
_DATA_REFRESH_INTERVAL = 300

# Back-off caps
_RECONNECT_DELAY_MIN = 5.0
_RECONNECT_DELAY_MAX = 120.0


class TRWebSocketKeeper:
    """Keeps a single persistent, authenticated WebSocket connection to TR.

    The caller provides a *token_factory* callable that returns the current
    session token (or None). The keeper reconnects automatically when the
    server closes the connection, using the latest token each time.

    If TR rejects the token with HTTP 401, ``is_authenticated`` is set False
    and the keeper stops reconnecting until a new token is provided via
    ``update_token()``.
    """

    def __init__(self, token_factory: Callable[[], Optional[str]]) -> None:
        self._token_factory = token_factory
        self._ws: Optional[Any] = None
        self._task: Optional[asyncio.Task] = None

        self.is_authenticated: bool = False
        self.last_error: Optional[str] = None
        self._running: bool = False
        self._reconnect_delay: float = _RECONNECT_DELAY_MIN

        # Data collection & dynamic subscription management
        self.latest_data: dict[str, Any] = {
            "net_value": 0.0,
            "available_cash": 0.0,
            "invested_capital": 0.0,
            "invested_stocks_etfs": 0.0,
            "invested_crypto": 0.0,
            "value_stocks_etfs": 0.0,
            "value_crypto": 0.0,
            "total_profit": 0.0,
            "total_profit_percent": 0.0,
            "exemption_total": 1000.00,
            "exemption_used": 0.00,
            "savings_plans_count": 0,
            "holdings": [],
            "card_status": "INACTIVE",
            "card_saveback_earned": 0.0,
            "card_saveback_limit": 0.0,
            "recent_transactions": [],
            "interest_rate": 2.25,
            "accrued_interest_daily": 0.0,
            "accrued_interest_monthly_est": 0.0,
        }
        self.last_data_update_time: Optional[float] = None
        self.active_categories: set[str] = {"portfolio", "cash", "savings", "card", "timeline"}
        self._subscribed_categories: dict[str, int] = {}
        self._portfolio_payload: dict[str, Any] = {}
        self._prices: dict[str, float] = {}
        self._ticker_subs: dict[int, dict[str, Any]] = {}
        self._sub_map: dict[int, str] = {}
        self._sub_counter: int = 10

    # ─── Public API ──────────────────────────────────────────────────────────

    def start(self) -> None:
        """Start the keeper loop as a background task."""
        if self._task and not self._task.done():
            return
        self._running = True
        self._task = asyncio.create_task(self._run_loop(), name="tr-ws-keeper")

    def stop(self) -> None:
        """Stop the keeper and close the connection."""
        self._running = False
        if self._task and not self._task.done():
            self._task.cancel()
        if self._ws:
            asyncio.create_task(self._close_ws())

    def update_token(self, token: str) -> None:
        """Provide a new token; reconnect if currently disconnected."""
        self.last_error = None
        self._running = True
        if self._task and not self._task.done():
            self._task.cancel()
        self._task = asyncio.create_task(self._run_loop(), name="tr-ws-keeper")

    async def sync_categories(self, categories: set[str]) -> None:
        """Dynamically add or remove subscriptions based on requested active categories."""
        if not categories:
            categories = {"portfolio", "cash"}
        self.active_categories = categories

        if not self._ws or not self.is_authenticated:
            return

        cat_type_map = {
            "portfolio": "compactPortfolioByType",
            "cash": "cash",
            "savings": "savingsPlans",
            "card": "card",
            "timeline": "timeline",
        }

        # Subscribe newly enabled categories
        for cat in self.active_categories:
            if cat not in self._subscribed_categories and cat in cat_type_map:
                sub_id = self._sub_counter
                self._sub_counter += 1
                self._subscribed_categories[cat] = sub_id
                self._sub_map[sub_id] = cat
                try:
                    await self._ws.send(f'sub {sub_id} {{"type":"{cat_type_map[cat]}"}}')
                    _LOGGER.info("WS Keeper: dynamically subscribed to category '%s' (sub %s)", cat, sub_id)
                except Exception as exc:
                    _LOGGER.debug("WS Keeper: dynamic sub '%s' failed: %s", cat, exc)

        # Unsubscribe disabled categories (keep portfolio and cash always active for basic functionality)
        for cat in list(self._subscribed_categories.keys()):
            if cat not in ("portfolio", "cash") and cat not in self.active_categories:
                sub_id = self._subscribed_categories.pop(cat)
                self._sub_map.pop(sub_id, None)
                try:
                    await self._ws.send(f"unsub {sub_id}")
                    _LOGGER.info("WS Keeper: unsubscribed from disabled category '%s' (sub %s)", cat, sub_id)
                except Exception as exc:
                    _LOGGER.debug("WS Keeper: dynamic unsub '%s' failed: %s", cat, exc)

    # ─── Internal ────────────────────────────────────────────────────────────

    async def _close_ws(self) -> None:
        try:
            if self._ws:
                await self._ws.close()
        except Exception:  # noqa: BLE001
            pass

    async def _connect(self) -> bool:
        """Open WebSocket, perform TR handshake and subscribe to live data streams with retry."""
        for attempt in range(3):
            token = self._token_factory()
            if not token:
                _LOGGER.debug("WS Keeper: no token available, skipping connect")
                return False

            clean = token.strip().strip('"').strip("'")
            if clean.lower().startswith("bearer "):
                clean = clean[7:].strip()

            ssl_ctx = ssl.create_default_context()
            headers = {
                "User-Agent": _USER_AGENT,
                "Origin": "https://app.traderepublic.com",
                "Authorization": f"Bearer {clean}",
                "Cookie": f"tr_session={clean}; tr_session_id={clean}; sessionToken={clean}",
            }

            try:
                self._ws = await websockets.connect(
                    _TR_WS_URL,
                    ssl=ssl_ctx,
                    additional_headers=headers,
                    ping_interval=20,
                    ping_timeout=20,
                    close_timeout=5,
                )
            except Exception as first_exc:
                if attempt < 2:
                    await asyncio.sleep(2**attempt)
                    continue
                _LOGGER.warning("WS Keeper: connection error: %s", first_exc)
                if "401" in str(first_exc) or getattr(first_exc, "status_code", None) == 401:
                    # Before marking permanently expired, attempt token refresh via background Chromium
                    try:
                        from browser import browser_service

                        if browser_service and browser_service.cdp:
                            _LOGGER.info("WS Keeper got 401 — triggering background Chromium session rotation...")
                            await browser_service.auth_helper.inject_session_cookies(clean)
                            await browser_service.cdp.send_cmd(
                                "Page.navigate", {"url": "https://app.traderepublic.com"}
                            )
                            await asyncio.sleep(6)
                            new_tok = await browser_service.auth_helper.extract_token_from_cookies()
                            if new_tok and new_tok != clean:
                                from core.verifier import verify_tr_token

                                if await verify_tr_token(new_tok):
                                    _LOGGER.info(
                                        "WS Keeper: recovered fresh valid session token from Chromium! Reconnecting..."
                                    )
                                    await browser_service.save_session(new_tok)
                                    self._reconnect_delay = _RECONNECT_DELAY_MIN
                                    return False  # Main loop will immediately retry with new saved token
                    except Exception as rot_exc:  # noqa: BLE001
                        _LOGGER.debug("Chromium token recovery failed: %s", rot_exc)

                    # Do NOT kill the reconnection loop permanently on first 401; wait and retry via browser
                    self.is_authenticated = False
                    self.last_error = (
                        f"Session expired or rejected by Trade Republic (HTTP 401: {first_exc}). Re-authenticating..."
                    )
                return False

            # Handshake
            handshake = {**_HANDSHAKE_PAYLOAD, "token": clean}
            try:
                async with asyncio.timeout(10):
                    await self._ws.send("connect 26 " + json.dumps(handshake))
                    resp = await self._ws.recv()
                    _LOGGER.info("WS Keeper: handshake response: %s", resp)
                    resp_str = str(resp)
                    if not resp or (
                        "connected" not in resp_str and "26" not in resp_str and "success" not in resp_str.lower()
                    ):
                        if "401" in resp_str or "error" in resp_str.lower():
                            if attempt < 2:
                                await self._close_ws()
                                await asyncio.sleep(2**attempt)
                                continue
                            _LOGGER.warning("WS Keeper: TR rejected handshake — token invalid")
                            self.is_authenticated = False
                            self.last_error = (
                                "Session expired or rejected by Trade Republic (HTTP 401). Please re-authenticate."
                            )
                            await self._close_ws()
                            return False
                        _LOGGER.debug("WS Keeper: unexpected handshake response: %s", resp)
                        await self._close_ws()
                        return False

                # Reset subscription mapping & state
                self._sub_map = {}
                self._subscribed_categories = {}
                self._ticker_subs = {}
                self._prices = {}
                self._portfolio_payload = {}
                if not self.latest_data:
                    self.latest_data = {
                        "net_value": 0.0,
                        "available_cash": 0.0,
                        "invested_capital": 0.0,
                        "savings_plans_count": 0,
                        "holdings": [],
                        "card_status": "INACTIVE",
                        "card_saveback_earned": 0.0,
                        "card_saveback_limit": 0.0,
                        "recent_transactions": [],
                        "interest_rate": 2.25,
                        "accrued_interest_daily": 0.0,
                        "accrued_interest_monthly_est": 0.0,
                    }

                # Register active subscriptions based on current active_categories
                cat_type_map = {
                    "portfolio": "compactPortfolioByType",
                    "cash": "cash",
                    "savings": "savingsPlans",
                    "card": "card",
                    "timeline": "timeline",
                }
                for cat in self.active_categories:
                    if cat in cat_type_map:
                        sub_id = self._sub_counter
                        self._sub_counter += 1
                        self._subscribed_categories[cat] = sub_id
                        self._sub_map[sub_id] = cat
                        await self._ws.send(f'sub {sub_id} {{"type":"{cat_type_map[cat]}"}}')
                _LOGGER.info("WS Keeper: initial active subscriptions registered (%s)", list(self.active_categories))

                self.is_authenticated = True
                self.last_error = None
                self._reconnect_delay = _RECONNECT_DELAY_MIN
                _LOGGER.info("WS Keeper: authenticated and connected to Trade Republic")
                return True
            except Exception as exc:
                _LOGGER.debug("WS Keeper: handshake/sub failed: %s", exc)
                await self._close_ws()
                if attempt < 2:
                    await asyncio.sleep(2**attempt)
                    continue
                return False

        return False

    def _recalculate_portfolio(self) -> None:
        """Recalculate portfolio metrics from latest in-memory payload & ticker prices."""
        import time

        self.last_data_update_time = time.time()
        categories = self._portfolio_payload.get("categories", [])
        positions = [pos for cat in categories for pos in cat.get("positions", [])]

        invested_capital = 0.0
        securities_value = 0.0
        invested_stocks_etfs = 0.0
        invested_crypto = 0.0
        value_stocks_etfs = 0.0
        value_crypto = 0.0
        holdings = []

        for pos in positions:
            isin = pos.get("isin")
            name = pos.get("name", isin)
            instrument_type = str(pos.get("instrumentType", "")).lower()
            is_crypto = instrument_type == "crypto" or (isin and str(isin).startswith("XF"))
            try:
                net_size = float(pos.get("netSize", 0.0))
                average_buy_in = float(pos.get("averageBuyIn", 0.0))
            except ValueError, TypeError:
                continue

            pos_invested = net_size * average_buy_in
            invested_capital += pos_invested
            if is_crypto:
                invested_crypto += pos_invested
            else:
                invested_stocks_etfs += pos_invested

            raw_net_value = pos.get("netValue") or pos.get("value") or pos.get("marketValue") or pos.get("currentValue")
            raw_profit = (
                pos.get("unrealisedProfit")
                or pos.get("unrealisedPnl")
                or pos.get("unrealizedProfit")
                or pos.get("profit")
            )

            if raw_net_value is not None:
                pos_value = float(raw_net_value)
            elif raw_profit is not None:
                pos_value = pos_invested + float(raw_profit)
            else:
                current_price = self._prices.get(isin, average_buy_in)
                pos_value = net_size * current_price

            securities_value += pos_value
            if is_crypto:
                value_crypto += pos_value
            else:
                value_stocks_etfs += pos_value

            holdings.append(
                {
                    "isin": isin,
                    "name": name,
                    "value": pos_value,
                    "type": "crypto" if is_crypto else "stock_etf",
                }
            )

        available_cash = float(self.latest_data.get("available_cash", 0.0))
        self.latest_data["invested_capital"] = invested_capital
        self.latest_data["invested_stocks_etfs"] = invested_stocks_etfs
        self.latest_data["invested_crypto"] = invested_crypto
        self.latest_data["value_stocks_etfs"] = value_stocks_etfs
        self.latest_data["value_crypto"] = value_crypto
        self.latest_data["net_value"] = securities_value + available_cash
        self.latest_data["total_profit"] = securities_value - invested_capital
        self.latest_data["total_profit_percent"] = (
            (self.latest_data["total_profit"] / invested_capital * 100) if invested_capital > 0 else 0.0
        )
        self.latest_data["holdings"] = holdings

        # Interest calculations
        active_rate = float(self.latest_data.get("api_interest_rate") or 2.25)
        rate_factor = active_rate / 100.0 if active_rate > 1.0 else active_rate
        self.latest_data["interest_rate"] = round(rate_factor * 100.0, 4)
        self.latest_data["accrued_interest_daily"] = available_cash * (rate_factor / 365.0)
        self.latest_data["accrued_interest_monthly_est"] = available_cash * (rate_factor / 12.0)

    async def _handle_message(self, raw_msg: str) -> None:
        """Parse incoming WebSocket messages and update latest_data in-memory."""
        parts = raw_msg.split(" ", 2)
        if len(parts) < 3:
            return
        sub_id_str, status, payload_str = parts
        if status != "A":
            return

        try:
            sub_id = int(sub_id_str)
            payload = json.loads(payload_str)
        except ValueError, json.JSONDecodeError, TypeError:
            return

        # Check main subscriptions
        sub_type = self._sub_map.get(sub_id)
        if sub_type == "portfolio":
            self._portfolio_payload = payload
            self._recalculate_portfolio()

            # Subscribe to tickers for positions if not subscribed yet
            for cat in payload.get("categories", []):
                for pos in cat.get("positions", []):
                    isin = pos.get("isin")
                    if isin and isin not in [p.get("isin") for p in self._ticker_subs.values()]:
                        ex_ids = pos.get("exchangeIds")
                        ex_suffix = ex_ids[0] if isinstance(ex_ids, list) and ex_ids else "LSX"
                        ticker_id = (
                            isin
                            if (pos.get("instrumentType") == "crypto" or isin.startswith("XF"))
                            else f"{isin}.{ex_suffix}"
                        )
                        ticker_sub_id = self._sub_counter
                        self._sub_counter += 1
                        self._ticker_subs[ticker_sub_id] = pos
                        if self._ws:
                            await self._ws.send(f'sub {ticker_sub_id} {{"type":"ticker","id":"{ticker_id}"}}')

        elif sub_type == "cash":
            target = payload[0] if isinstance(payload, list) and len(payload) > 0 else payload
            if isinstance(target, dict):
                self.latest_data["available_cash"] = float(target.get("amount") or target.get("availableCash") or 0.0)
                api_rate = target.get("interestRate") or target.get("rate") or target.get("interest")
                if api_rate is not None:
                    try:
                        self.latest_data["api_interest_rate"] = float(api_rate)
                    except ValueError, TypeError:
                        pass
                self._recalculate_portfolio()

        elif sub_type == "savingsPlans":
            import time

            count = 0
            if isinstance(payload, list):
                count = len(payload)
            elif isinstance(payload, dict):
                plans = payload.get("savingsPlans") or payload.get("items") or payload.get("data") or []
                count = len(plans) if isinstance(plans, list) else int(payload.get("count", 0))
            self.latest_data["savings_plans_count"] = count
            self.last_data_update_time = time.time()
            _LOGGER.debug("WS Keeper: updated savings_plans_count to %s", count)

        elif sub_type == "card":
            import time

            self.latest_data["card_status"] = payload.get("status", "INACTIVE")
            self.latest_data["card_saveback_earned"] = float(payload.get("savebackEarned") or 0.0)
            self.latest_data["card_saveback_limit"] = float(payload.get("savebackLimit") or 0.0)
            self.last_data_update_time = time.time()

        elif sub_type == "timeline":
            import time

            items = payload.get("items", [])
            txs = []
            for item in items[:5]:
                amount_val = 0.0
                amount_obj = item.get("amount")
                if isinstance(amount_obj, dict):
                    amount_val = float(amount_obj.get("value") or 0.0)
                txs.append(
                    {
                        "title": item.get("title"),
                        "subtitle": item.get("subtitle"),
                        "amount": amount_val,
                        "timestamp": item.get("timestamp"),
                    }
                )
            self.latest_data["recent_transactions"] = txs
            self.last_data_update_time = time.time()

        elif sub_id in self._ticker_subs:
            # Ticker price update
            pos = self._ticker_subs[sub_id]
            isin = pos.get("isin")
            if isin:

                def _parse_p(val: Any) -> Optional[float]:
                    if isinstance(val, (int, float)):
                        return float(val)
                    if isinstance(val, dict):
                        p = val.get("price")
                        if p is not None:
                            try:
                                return float(p)
                            except ValueError, TypeError:
                                pass
                    return None

                price = (
                    _parse_p(payload.get("last"))
                    or _parse_p(payload.get("bid"))
                    or _parse_p(payload.get("ask"))
                    or _parse_p(payload.get("price"))
                )
                if price is not None:
                    self._prices[isin] = price
                    self._recalculate_portfolio()

    async def _periodic_refresh_loop(self) -> None:
        """Periodically re-request active category subscriptions (every 5 min) to ensure fresh data without rate limiting."""
        cat_type_map = {
            "portfolio": "compactPortfolioByType",
            "cash": "cash",
            "savings": "savingsPlans",
            "card": "card",
            "timeline": "timeline",
        }
        while self._ws is not None and self.is_authenticated:
            try:
                await asyncio.sleep(_DATA_REFRESH_INTERVAL)
                if not self._ws or not self.is_authenticated:
                    break
                for cat in list(self.active_categories):
                    if cat in cat_type_map and self._ws:
                        sub_id = self._sub_counter
                        self._sub_counter += 1
                        old_sub = self._subscribed_categories.get(cat)
                        if old_sub:
                            self._sub_map.pop(old_sub, None)
                            try:
                                await self._ws.send(f"unsub {old_sub}")
                            except Exception:  # noqa: BLE001
                                pass
                        self._subscribed_categories[cat] = sub_id
                        self._sub_map[sub_id] = cat
                        await self._ws.send(f'sub {sub_id} {{"type":"{cat_type_map[cat]}"}}')
                        await asyncio.sleep(0.5)
            except asyncio.CancelledError:
                break
            except Exception as exc:
                _LOGGER.debug("WS Keeper: periodic refresh cycle info: %s", exc)

    async def _receive_loop(self) -> None:
        """Drain incoming messages from persistent subscriptions to update latest_data."""
        while self._ws is not None:
            try:
                msg = await self._ws.recv()
                if msg:
                    await self._handle_message(str(msg))
            except Exception as exc:
                _LOGGER.debug("WS Keeper: recv ended/disconnected: %s", exc)
                return

    async def _run_loop(self) -> None:
        """Main reconnect loop — keeps connection alive indefinitely."""
        while self._running:
            token = self._token_factory()
            if not token:
                _LOGGER.debug("WS Keeper: waiting for token...")
                await asyncio.sleep(10)
                continue

            connected = await self._connect()
            if not connected:
                delay = min(self._reconnect_delay, _RECONNECT_DELAY_MAX)
                _LOGGER.debug("WS Keeper: reconnecting in %.0f s", delay)
                self._reconnect_delay = min(self._reconnect_delay * 1.5, _RECONNECT_DELAY_MAX)
                await asyncio.sleep(delay)
                continue

            refresh_task = asyncio.create_task(self._periodic_refresh_loop())
            try:
                await self._receive_loop()
            finally:
                refresh_task.cancel()
                await self._close_ws()
                self._ws = None

            if self._running:
                if self.is_authenticated:
                    _LOGGER.info("WS Keeper: connection closed, reconnecting in %.0f s", self._reconnect_delay)
                    await asyncio.sleep(self._reconnect_delay)
                    self._reconnect_delay = min(self._reconnect_delay * 1.5, _RECONNECT_DELAY_MAX)
                else:
                    await asyncio.sleep(30)
