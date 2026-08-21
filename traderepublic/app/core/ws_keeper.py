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

_LOGGER = logging.getLogger(__name__)

_TR_WS_URL = "wss://api.traderepublic.com"
_HANDSHAKE_PAYLOAD = {
    "locale": "de",
    "platformId": "web",
    "appVersion": "4.120.0",
    "osVersion": "10.0.0",
}
_USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/128.0.0.0 Safari/537.36"
)

# Keepalive heartbeat interval — send a lightweight sub every 60 s to keep the
# connection alive. TR drops idle connections after ~90 s.
_HEARTBEAT_INTERVAL = 60

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
        # Token factory will pick it up automatically on next (re)connect.
        if not self.is_authenticated and self._running:
            if self._task and not self._task.done():
                self._task.cancel()
            self._task = asyncio.create_task(self._run_loop(), name="tr-ws-keeper")

    # ─── Internal ────────────────────────────────────────────────────────────

    async def _close_ws(self) -> None:
        try:
            if self._ws:
                await self._ws.close()
        except Exception:  # noqa: BLE001
            pass

    async def _connect(self) -> bool:
        """Open WebSocket and perform TR handshake. Returns True on success."""
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
            "Cookie": f"tr_session={clean}; tr_session_id={clean}; sessionToken={clean}",
        }

        try:
            # Enable standard WebSocket ping/pong keepalive every 20s.
            # Trade Republic WebSocket supports protocol-level Ping frames natively
            # without triggering query rate limits or stream drops.
            self._ws = await websockets.connect(
                _TR_WS_URL,
                ssl=ssl_ctx,
                additional_headers=headers,
                ping_interval=20,
                ping_timeout=20,
                close_timeout=5,
            )
        except Exception as exc:
            err_str = str(exc)
            if "401" in err_str or getattr(exc, "status_code", None) == 401:
                _LOGGER.warning("WS Keeper: TR rejected token (HTTP 401) — stopping until new token")
                self.is_authenticated = False
                self.last_error = "Session expired or rejected by Trade Republic (HTTP 401). Please re-authenticate."
                return False
            _LOGGER.debug("WS Keeper: connection error: %s", exc)
            return False

        # Handshake
        handshake = {**_HANDSHAKE_PAYLOAD, "token": clean}
        try:
            async with asyncio.timeout(10):
                await self._ws.send("connect 26 " + json.dumps(handshake))
                resp = await self._ws.recv()
                _LOGGER.info("WS Keeper: handshake response: %s", resp)
                if not resp or "connected" not in str(resp):
                    if "401" in str(resp) or "error" in str(resp).lower():
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

                # Subscribe once to compactPortfolioByType — persistent live stream
                # that matches normal Trade Republic app behavior and keeps the session active
                await self._ws.send('sub 1 {"type":"compactPortfolioByType"}')
                _LOGGER.debug("WS Keeper: subscribed to persistent compactPortfolioByType stream")
        except Exception as exc:
            _LOGGER.debug("WS Keeper: handshake/sub failed: %s", exc)
            await self._close_ws()
            return False

        self.is_authenticated = True
        self.last_error = None
        self._reconnect_delay = _RECONNECT_DELAY_MIN
        _LOGGER.info("WS Keeper: authenticated and connected to Trade Republic")
        return True

    async def _receive_loop(self) -> None:
        """Drain incoming messages from persistent subscription to maintain connection."""
        while self._ws is not None:
            try:
                msg = await self._ws.recv()
                _LOGGER.debug("WS Keeper: recv: %s", str(msg)[:120])
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
                if not self.is_authenticated and self.last_error and "401" in self.last_error:
                    # Hard auth failure — wait for update_token() to reset state
                    _LOGGER.debug("WS Keeper: pausing reconnect until new token provided")
                    await asyncio.sleep(30)
                    continue
                delay = min(self._reconnect_delay, _RECONNECT_DELAY_MAX)
                _LOGGER.debug("WS Keeper: reconnecting in %.0f s", delay)
                self._reconnect_delay = min(self._reconnect_delay * 2, _RECONNECT_DELAY_MAX)
                await asyncio.sleep(delay)
                continue

            try:
                await self._receive_loop()
            finally:
                await self._close_ws()
                self._ws = None

            if self._running:
                if self.is_authenticated:
                    # Connection dropped unexpectedly, reconnect with short backoff
                    _LOGGER.info("WS Keeper: connection closed, reconnecting in %.0f s", self._reconnect_delay)
                    await asyncio.sleep(self._reconnect_delay)
                    self._reconnect_delay = min(self._reconnect_delay * 1.5, _RECONNECT_DELAY_MAX)
                else:
                    await asyncio.sleep(30)

