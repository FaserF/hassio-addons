"""Persistent WebSocket connection keeper for Trade Republic.

Maintains a single long-lived authenticated WebSocket connection to
wss://api.traderepublic.com with lightweight subscriptions.
"""

import asyncio
import contextlib
import inspect
import json
import logging
import ssl
import time
from collections.abc import Callable
from typing import Any

import websockets

from .constants import USER_AGENT
from .webhook import TRWebhookDispatcher

_LOGGER = logging.getLogger(__name__)
_TR_WS_URL = "wss://api.traderepublic.com"
_HANDSHAKE_PAYLOAD = {"locale": "de", "platformId": "web", "appVersion": "4.120.0", "osVersion": "10.0.0"}
_CAT_TYPE_MAP = {
    "portfolio": "compactPortfolioByType",
    "cash": "cash",
    "savings": "savingsPlans",
    "card": "card",
    "timeline": "timeline",
}
_DATA_REFRESH_INTERVAL = 300
_RECONNECT_DELAY_MIN = 5.0
_RECONNECT_DELAY_MAX = 120.0
_AUTH_EXPIRED_MSG = "Session expired or rejected by Trade Republic (HTTP 401). Please re-authenticate."


def _is_http_401(exc: Exception) -> bool:
    if "401" in str(exc) or getattr(exc, "status_code", None) == 401:
        return True
    resp = getattr(exc, "response", None)
    return getattr(resp, "status_code", None) == 401


def _parse_price(val: Any) -> float | None:
    if isinstance(val, (int, float)):
        return float(val)
    if isinstance(val, dict) and val.get("price") is not None:
        with contextlib.suppress(ValueError, TypeError):
            return float(val["price"])
    return None


def _default_latest_data() -> dict[str, Any]:
    return {
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


class TRWebSocketKeeper:
    """Keeps a single persistent, authenticated WebSocket connection to TR."""

    def __init__(
        self,
        token_factory: Callable[[], str | None],
        on_data_callback: Callable[[dict[str, Any]], None] | None = None,
        on_auth_lost_callback: Callable[..., Any] | None = None,
        on_token_refresh: Callable[[], Any] | None = None,
    ) -> None:
        self._token_factory = token_factory
        self._on_data_callback = on_data_callback
        self._on_auth_lost_callback = on_auth_lost_callback
        self._on_token_refresh = on_token_refresh
        self._ws: Any | None = None
        self._task: asyncio.Task | None = None
        self._connected_event = asyncio.Event()
        self.is_authenticated: bool = False
        self.last_error: str | None = None
        self._running: bool = False
        self._reconnect_delay: float = _RECONNECT_DELAY_MIN
        self.latest_data: dict[str, Any] = _default_latest_data()
        self.last_data_update_time: float | None = None
        self.active_categories: set[str] = {"portfolio", "cash", "savings", "card", "timeline"}
        self._subscribed_categories: dict[str, int] = {}
        self._portfolio_payload: dict[str, Any] = {}
        self._prices: dict[str, float] = {}
        self._ticker_subs: dict[int, dict[str, Any]] = {}
        self._instrument_subs: dict[int, dict[str, Any]] = {}
        self._ticker_fallbacks: dict[str, list[str]] = {}
        self._subscribed_isins: set[str] = set()
        self._sub_map: dict[int, str] = {}
        self._sub_counter: int = 10
        self.webhook: TRWebhookDispatcher = TRWebhookDispatcher()

    @property
    def is_connecting(self) -> bool:
        """True while keeper is actively connecting with a token and no auth error yet."""
        return bool(self._running and not self.is_authenticated and self.last_error is None and self._token_factory())

    def start(self) -> None:
        """Start the keeper loop as a background task."""
        if self._task and not self._task.done():
            return
        self._running = True
        self._task = asyncio.create_task(self._run_loop(), name="tr-ws-keeper")

    def stop(self, shutdown: bool = False) -> None:
        """Stop the keeper and close the connection."""
        self._running = False
        self.is_authenticated = False
        self._connected_event.clear()
        if self._task and not self._task.done():
            self._task.cancel()
        if self._ws:
            with contextlib.suppress(RuntimeError):
                asyncio.get_running_loop().create_task(self._close_ws())
        if shutdown:
            with contextlib.suppress(RuntimeError):
                asyncio.get_running_loop().create_task(self.webhook.close())

    def update_token(self, token: str) -> None:
        """Provide a new token and reconnect cleanly."""
        self.last_error = None
        self.is_authenticated = False
        self._connected_event.clear()
        self._running = True
        if self._task and not self._task.done():
            self._task.cancel()
        if self._ws:
            with contextlib.suppress(RuntimeError):
                asyncio.get_running_loop().create_task(self._close_ws())
        self._task = asyncio.create_task(self._run_loop(), name="tr-ws-keeper")

    async def wait_until_connected(self, timeout: float = 8.0) -> bool:
        """Wait up to timeout seconds until authenticated or aborted."""
        if self.is_authenticated:
            return True
        deadline = time.monotonic() + timeout
        while self._running and not self.is_authenticated:
            remaining = deadline - time.monotonic()
            if remaining <= 0:
                return False
            try:
                await asyncio.wait_for(self._connected_event.wait(), timeout=min(remaining, 0.25))
            except TimeoutError:
                continue
        return self.is_authenticated

    async def sync_categories(self, categories: set[str]) -> None:
        """Dynamically add or remove subscriptions based on requested active categories."""
        effective = set(categories) if categories else {"portfolio", "cash"}
        effective.update({"portfolio", "cash"})
        if self.webhook.enabled:
            effective.add("timeline")
        self.active_categories = effective
        if not self._ws or not self.is_authenticated:
            return

        for cat in effective:
            if cat not in self._subscribed_categories and cat in _CAT_TYPE_MAP:
                sub_id = self._next_sub_id()
                self._subscribed_categories[cat] = sub_id
                self._sub_map[sub_id] = cat
                try:
                    await self._ws.send(f'sub {sub_id} {{"type":"{_CAT_TYPE_MAP[cat]}"}}')
                    _LOGGER.info("WS Keeper: dynamically subscribed to category '%s' (sub %s)", cat, sub_id)
                except Exception as exc:
                    _LOGGER.debug("WS Keeper: dynamic sub '%s' failed: %s", cat, exc)

        protected = {"portfolio", "cash"} | ({"timeline"} if self.webhook.enabled else set())
        for cat in list(self._subscribed_categories.keys()):
            if cat not in protected and cat not in effective:
                sub_id = self._subscribed_categories.pop(cat)
                self._sub_map.pop(sub_id, None)
                try:
                    await self._ws.send(f"unsub {sub_id}")
                    _LOGGER.info("WS Keeper: unsubscribed from disabled category '%s' (sub %s)", cat, sub_id)
                except Exception as exc:
                    _LOGGER.debug("WS Keeper: dynamic unsub '%s' failed: %s", cat, exc)

    def _next_sub_id(self) -> int:
        sub_id = self._sub_counter
        self._sub_counter += 1
        return sub_id

    async def _close_ws(self) -> None:
        with contextlib.suppress(Exception):
            if self._ws:
                await self._ws.close()

    async def _abort_on_auth_loss(self, reason: str) -> None:
        """Mark session expired, stop reconnect loop, and notify owner once."""
        self.is_authenticated = False
        self.last_error = reason
        self._running = False
        self._connected_event.clear()
        await self._close_ws()
        self._ws = None
        if self._on_auth_lost_callback and callable(self._on_auth_lost_callback):
            try:
                sig = inspect.signature(self._on_auth_lost_callback)
                kinds = (
                    inspect.Parameter.POSITIONAL_ONLY,
                    inspect.Parameter.POSITIONAL_OR_KEYWORD,
                    inspect.Parameter.VAR_POSITIONAL,
                )
                accepts_arg = any(p.kind in kinds for p in sig.parameters.values())
                res = self._on_auth_lost_callback(reason) if accepts_arg else self._on_auth_lost_callback()
                if inspect.isawaitable(res):
                    await res
            except Exception as cb_exc:  # noqa: BLE001
                _LOGGER.debug("WS Keeper: auth lost callback error: %s", cb_exc)

    async def _try_rotate_token(self) -> bool:
        """Invoke browser token refresh callback if provided."""
        if not self._on_token_refresh or not callable(self._on_token_refresh):
            return False
        try:
            if await self._on_token_refresh():
                _LOGGER.info("WS Keeper: recovered fresh valid session token from Chromium! Reconnecting...")
                self._reconnect_delay = _RECONNECT_DELAY_MIN
                return True
        except Exception as rot_exc:  # noqa: BLE001
            _LOGGER.debug("Chromium token recovery failed: %s", rot_exc)
        return False

    async def _connect(self) -> bool:
        """Open WebSocket, perform TR handshake and subscribe to live data streams."""
        rotation_attempted = False
        attempt = 0
        while attempt < 3 and self._running:
            token = self._token_factory()
            if not token:
                _LOGGER.debug("WS Keeper: no token available, skipping connect")
                return False
            clean = token.strip().strip('"').strip("'")
            if clean.lower().startswith("bearer "):
                clean = clean[7:].strip()
            headers = {
                "User-Agent": USER_AGENT,
                "Origin": "https://app.traderepublic.com",
                "Authorization": f"Bearer {clean}",
                "Cookie": f"tr_session={clean}; tr_session_id={clean}; sessionToken={clean}",
            }
            try:
                self._ws = await websockets.connect(
                    _TR_WS_URL,
                    ssl=ssl.create_default_context(),
                    additional_headers=headers,
                    ping_interval=20,
                    ping_timeout=20,
                    close_timeout=5,
                )
            except Exception as first_exc:
                if _is_http_401(first_exc):
                    _LOGGER.warning("WS Keeper: connection error: %s", first_exc)
                    if not rotation_attempted:
                        rotation_attempted = True
                        _LOGGER.info("WS Keeper: 401 Unauthorized — attempting single browser session rotation")
                        if await self._try_rotate_token():
                            continue
                    await self._abort_on_auth_loss(_AUTH_EXPIRED_MSG)
                    return False
                attempt += 1
                if attempt < 3:
                    await asyncio.sleep(2 ** (attempt - 1))
                    continue
                _LOGGER.warning("WS Keeper: connection error: %s", first_exc)
                return False
            if not self._ws:
                return False
            handshake = {**_HANDSHAKE_PAYLOAD, "token": clean}
            try:
                async with asyncio.timeout(10):
                    await self._ws.send("connect 26 " + json.dumps(handshake))
                    resp = await self._ws.recv()
                    _LOGGER.info("WS Keeper: handshake response: %s", resp)
                    resp_str = str(resp)
                    resp_lower = resp_str.lower()
                    is_auth_err = resp_str.startswith(f"{26} E") or any(
                        k in resp_lower for k in ("401", "error", "unauth", "invalid")
                    )
                    is_ok = (
                        bool(resp)
                        and not is_auth_err
                        and ("connected" in resp_lower or "success" in resp_lower or resp_str.startswith("26 A"))
                    )
                    if not is_ok:
                        await self._close_ws()
                        self._ws = None
                        if is_auth_err:
                            if not rotation_attempted:
                                rotation_attempted = True
                                _LOGGER.info("WS Keeper: handshake rejected (401) — attempting single browser rotation")
                                if await self._try_rotate_token():
                                    continue
                            _LOGGER.warning("WS Keeper: TR rejected handshake — token invalid")
                            await self._abort_on_auth_loss(_AUTH_EXPIRED_MSG)
                            return False
                        _LOGGER.debug("WS Keeper: unexpected handshake response: %s", resp)
                        return False
                self._sub_map, self._subscribed_categories = {}, {}
                self._ticker_subs, self._instrument_subs = {}, {}
                self._ticker_fallbacks, self._subscribed_isins, self._portfolio_payload = {}, set(), {}
                effective = (
                    set(self.active_categories)
                    | {"portfolio", "cash"}
                    | ({"timeline"} if self.webhook.enabled else set())
                )
                self.active_categories = effective
                for cat in effective:
                    if cat in _CAT_TYPE_MAP:
                        sub_id = self._next_sub_id()
                        self._subscribed_categories[cat], self._sub_map[sub_id] = sub_id, cat
                        await self._ws.send(f'sub {sub_id} {{"type":"{_CAT_TYPE_MAP[cat]}"}}')
                _LOGGER.info("WS Keeper: initial active subscriptions registered (%s)", sorted(effective))
                self.is_authenticated, self.last_error, self._reconnect_delay = True, None, _RECONNECT_DELAY_MIN
                self._connected_event.set()
                _LOGGER.info("WS Keeper: authenticated and connected to Trade Republic")
                return True
            except Exception as exc:
                _LOGGER.debug("WS Keeper: handshake/sub failed: %s", exc)
                await self._close_ws()
                self._ws = None
                attempt += 1
                if attempt < 3:
                    await asyncio.sleep(2 ** (attempt - 1))
                    continue
                return False
        return False

    @staticmethod
    def _default_exchanges(pos: dict[str, Any]) -> list[str]:
        isin = str(pos.get("isin", ""))
        is_crypto = str(pos.get("instrumentType", "")).lower() == "crypto" or isin.startswith("XF")
        return ["BHS", "B2C", "LSX"] if is_crypto else ["LSX", "TDG", "XET"]

    async def _subscribe_instrument(self, pos: dict[str, Any]) -> None:
        isin = str(pos.get("isin", ""))
        if not isin or not self._ws:
            return
        sub_id = self._next_sub_id()
        self._instrument_subs[sub_id] = pos
        await self._ws.send(f'sub {sub_id} {{"type":"instrument","id":"{isin}"}}')
        _LOGGER.debug("WS Keeper: querying instrument metadata for %s (sub %s)", isin, sub_id)

    async def _subscribe_ticker(self, pos: dict[str, Any], exchange: str, fallbacks: list[str] | None = None) -> None:
        isin = str(pos.get("isin", ""))
        if not isin or not self._ws:
            return
        if fallbacks is not None:
            self._ticker_fallbacks[isin] = list(fallbacks)
        ticker_id = f"{isin}.{exchange}"
        sub_id = self._next_sub_id()
        self._ticker_subs[sub_id] = pos
        await self._ws.send(f'sub {sub_id} {{"type":"ticker","id":"{ticker_id}"}}')
        _LOGGER.debug("WS Keeper: subscribed ticker %s (sub %s)", ticker_id, sub_id)

    def _recalculate_portfolio(self) -> None:
        """Recalculate portfolio metrics from latest in-memory payload & ticker prices."""
        self.last_data_update_time = time.time()
        positions = [pos for cat in self._portfolio_payload.get("categories", []) for pos in cat.get("positions", [])]
        invested_capital = securities_value = 0.0
        invested_stocks_etfs = invested_crypto = value_stocks_etfs = value_crypto = 0.0
        holdings = []

        for pos in positions:
            isin = pos.get("isin")
            is_crypto = str(pos.get("instrumentType", "")).lower() == "crypto" or bool(
                isin and str(isin).startswith("XF")
            )
            try:
                net_size, average_buy_in = float(pos.get("netSize", 0.0)), float(pos.get("averageBuyIn", 0.0))
            except (ValueError, TypeError):
                continue

            pos_invested = net_size * average_buy_in
            invested_capital += pos_invested
            if is_crypto:
                invested_crypto += pos_invested
            else:
                invested_stocks_etfs += pos_invested

            raw_net = pos.get("netValue") or pos.get("value") or pos.get("marketValue") or pos.get("currentValue")
            raw_pnl = (
                pos.get("unrealisedProfit")
                or pos.get("unrealisedPnl")
                or pos.get("unrealizedProfit")
                or pos.get("profit")
            )
            if raw_net is not None:
                pos_value = float(raw_net)
            elif raw_pnl is not None:
                pos_value = pos_invested + float(raw_pnl)
            else:
                pos_value = net_size * self._prices.get(isin, average_buy_in)

            securities_value += pos_value
            if is_crypto:
                value_crypto += pos_value
            else:
                value_stocks_etfs += pos_value
            holdings.append(
                {
                    "isin": isin,
                    "name": pos.get("name", isin),
                    "value": pos_value,
                    "type": "crypto" if is_crypto else "stock_etf",
                }
            )

        available_cash = float(self.latest_data.get("available_cash", 0.0))
        total_profit = securities_value - invested_capital
        self.latest_data.update(
            {
                "invested_capital": invested_capital,
                "invested_stocks_etfs": invested_stocks_etfs,
                "invested_crypto": invested_crypto,
                "value_stocks_etfs": value_stocks_etfs,
                "value_crypto": value_crypto,
                "net_value": securities_value + available_cash,
                "total_profit": total_profit,
                "total_profit_percent": (total_profit / invested_capital * 100) if invested_capital > 0 else 0.0,
                "holdings": holdings,
            }
        )
        active_rate = float(self.latest_data.get("api_interest_rate") or 2.25)
        rate_factor = active_rate / 100.0 if active_rate > 1.0 else active_rate
        self.latest_data["interest_rate"] = round(rate_factor * 100.0, 4)
        self.latest_data["accrued_interest_daily"] = available_cash * (rate_factor / 365.0)
        self.latest_data["accrued_interest_monthly_est"] = available_cash * (rate_factor / 12.0)

    def _extract_instrument_exchanges(self, payload: Any, pos: dict[str, Any]) -> list[str]:
        extracted: list[str] = []
        if isinstance(payload, dict):
            for ex in payload.get("exchangeIds") or []:
                if isinstance(ex, str) and ex:
                    extracted.append(ex)
            for ex_obj in payload.get("exchanges") or []:
                if isinstance(ex_obj, str) and ex_obj:
                    extracted.append(ex_obj)
                elif isinstance(ex_obj, dict) and (
                    ex_id := ex_obj.get("slug") or ex_obj.get("id") or ex_obj.get("exchangeId")
                ):
                    extracted.append(str(ex_id))
        return list(dict.fromkeys(extracted + self._default_exchanges(pos)))

    async def _handle_sub_error(self, sub_id: int) -> None:
        if sub_id in self._instrument_subs:
            pos = self._instrument_subs.pop(sub_id)
            candidates = self._default_exchanges(pos)
            await self._subscribe_ticker(pos, candidates[0], candidates[1:])
        elif sub_id in self._ticker_subs:
            pos = self._ticker_subs.pop(sub_id)
            isin = str(pos.get("isin", ""))
            if fallbacks := self._ticker_fallbacks.get(isin, []):
                next_ex = fallbacks.pop(0)
                _LOGGER.debug("WS Keeper: ticker fallback for %s -> %s", isin, next_ex)
                await self._subscribe_ticker(pos, next_ex)
            else:
                _LOGGER.debug("WS Keeper: all ticker exchange candidates failed for %s", isin)

    async def _handle_message(self, raw_msg: str) -> None:
        """Parse incoming WebSocket messages and update latest_data in-memory."""
        parts = raw_msg.split(" ", 2)
        if len(parts) < 2:
            return
        try:
            sub_id, status = int(parts[0]), parts[1]
        except ValueError:
            return
        if status == "E":
            await self._handle_sub_error(sub_id)
            return
        if status != "A":
            return
        try:
            payload = json.loads(parts[2] if len(parts) > 2 else "{}")
        except (ValueError, json.JSONDecodeError, TypeError):
            return

        sub_type = self._sub_map.get(sub_id)
        if sub_type == "portfolio":
            self._portfolio_payload = payload
            self._recalculate_portfolio()
            for cat in payload.get("categories", []):
                for pos in cat.get("positions", []):
                    isin = pos.get("isin")
                    if not isin or isin in self._subscribed_isins:
                        continue
                    self._subscribed_isins.add(isin)
                    if isinstance(ex_ids := pos.get("exchangeIds"), list) and ex_ids:
                        await self._subscribe_ticker(pos, str(ex_ids[0]), [str(x) for x in ex_ids[1:]])
                    else:
                        await self._subscribe_instrument(pos)

        elif sub_type == "cash":
            target = payload[0] if isinstance(payload, list) and payload else payload
            if isinstance(target, dict):
                self.latest_data["available_cash"] = float(target.get("amount") or target.get("availableCash") or 0.0)
                for key, field in (
                    ("api_interest_rate", target.get("interestRate") or target.get("rate") or target.get("interest")),
                    (
                        "exemption_total",
                        target.get("availableTaxExemption")
                        or target.get("taxExemptionTotal")
                        or target.get("taxExemption")
                        or target.get("exemptionTotal"),
                    ),
                    (
                        "exemption_used",
                        target.get("usedTaxExemption") or target.get("taxExemptionUsed") or target.get("exemptionUsed"),
                    ),
                ):
                    if field is not None:
                        with contextlib.suppress(ValueError, TypeError):
                            self.latest_data[key] = float(field)
                self._recalculate_portfolio()

        elif sub_type in ("savings", "savingsPlans"):
            count = len(payload) if isinstance(payload, list) else 0
            if isinstance(payload, dict):
                plans = payload.get("savingsPlans") or payload.get("items") or payload.get("data") or []
                count = len(plans) if isinstance(plans, list) else int(payload.get("count", 0))
            self.latest_data["savings_plans_count"] = count
            self.last_data_update_time = time.time()

        elif sub_type == "card":
            self.latest_data["card_status"] = payload.get("status", "INACTIVE")
            self.latest_data["card_saveback_earned"] = float(payload.get("savebackEarned") or 0.0)
            self.latest_data["card_saveback_limit"] = float(payload.get("savebackLimit") or 0.0)
            self.last_data_update_time = time.time()

        elif sub_type == "timeline":
            items = payload.get("items", [])
            txs = [
                {
                    "id": str(item.get("id") or f"{item.get('title')}_{item.get('timestamp')}"),
                    "title": item.get("title"),
                    "subtitle": item.get("subtitle"),
                    "amount": (
                        float(amt.get("value") or 0.0)
                        if isinstance(amt := item.get("amount"), dict)
                        else (float(amt) if isinstance(amt, (int, float)) else 0.0)
                    ),
                    "timestamp": item.get("timestamp"),
                }
                for item in items
            ]
            self.latest_data["recent_transactions"], self.latest_data["all_transactions"] = txs[:5], txs
            self.last_data_update_time = time.time()
            asyncio.create_task(self.webhook.handle_timeline_update(items))

        elif sub_id in self._instrument_subs:
            pos = self._instrument_subs.pop(sub_id)
            if self._ws:
                with contextlib.suppress(Exception):
                    await self._ws.send(f"unsub {sub_id}")
            candidates = self._extract_instrument_exchanges(payload, pos)
            await self._subscribe_ticker(pos, candidates[0], candidates[1:])

        elif sub_id in self._ticker_subs:
            pos = self._ticker_subs[sub_id]
            if (isin := pos.get("isin")) and isinstance(payload, dict):
                if (
                    price := next(
                        (p for k in ("last", "bid", "ask", "price") if (p := _parse_price(payload.get(k))) is not None),
                        None,
                    )
                ) is not None:
                    self._prices[isin] = price
                    self._recalculate_portfolio()
                    asyncio.create_task(self.webhook.check_price_threshold(isin, str(pos.get("name") or isin), price))

    async def _periodic_refresh_loop(self) -> None:
        """Periodically re-request active category subscriptions (every 5 min)."""
        while self._ws is not None and self.is_authenticated:
            try:
                await asyncio.sleep(_DATA_REFRESH_INTERVAL)
                if not self._ws or not self.is_authenticated:
                    break
                for cat in list(self.active_categories):
                    if cat in _CAT_TYPE_MAP and self._ws:
                        sub_id = self._next_sub_id()
                        if old_sub := self._subscribed_categories.get(cat):
                            self._sub_map.pop(old_sub, None)
                            with contextlib.suppress(Exception):
                                await self._ws.send(f"unsub {old_sub}")
                        self._subscribed_categories[cat] = sub_id
                        self._sub_map[sub_id] = cat
                        await self._ws.send(f'sub {sub_id} {{"type":"{_CAT_TYPE_MAP[cat]}"}}')
                        await asyncio.sleep(0.5)
            except asyncio.CancelledError:
                break
            except Exception as exc:
                _LOGGER.debug("WS Keeper: periodic refresh cycle info: %s", exc)

    async def _receive_loop(self) -> None:
        while self._ws is not None:
            try:
                if msg := await self._ws.recv():
                    await self._handle_message(str(msg))
            except Exception as exc:
                _LOGGER.debug("WS Keeper: recv ended/disconnected: %s", exc)
                return

    async def _run_loop(self) -> None:
        """Main reconnect loop — keeps connection alive until stopped or auth lost."""
        while self._running:
            if not self._token_factory():
                _LOGGER.debug("WS Keeper: waiting for token...")
                await asyncio.sleep(10)
                continue

            if not await self._connect():
                if not self._running:
                    _LOGGER.debug("WS Keeper: stopped (auth rejected). Awaiting re-login.")
                    return
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
                self.is_authenticated = False
                self._connected_event.clear()

            if self._running:
                if self.last_error and "401" in self.last_error:
                    _LOGGER.warning("WS Keeper: auth lost during session — stopping. Awaiting re-login.")
                    self._running = False
                    return
                _LOGGER.info("WS Keeper: connection closed, reconnecting in %.0f s", self._reconnect_delay)
                await asyncio.sleep(self._reconnect_delay)
                self._reconnect_delay = min(self._reconnect_delay * 1.5, _RECONNECT_DELAY_MAX)
