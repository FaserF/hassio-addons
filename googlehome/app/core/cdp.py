"""Chrome DevTools Protocol client with persistent WebSocket connection."""

import asyncio
import json
import logging
import time
from typing import Any, Dict, Optional

import aiohttp
import websockets

from .constants import CDP_PORT

_LOGGER = logging.getLogger(__name__)


class CDPClient:
    """Client to communicate with Headless Chromium via Chrome DevTools Protocol.

    Uses a persistent WebSocket connection to avoid per-command reconnect overhead
    and to correctly follow the active page after navigation.
    """

    def __init__(self, port: int = CDP_PORT) -> None:
        self.port = port
        self._ws: Any = None  # websockets.WebSocketClientProtocol
        self._ws_url: Optional[str] = None
        self._msg_id: int = 1
        self._pending: Dict[int, asyncio.Future] = {}
        self._recv_task: Optional[asyncio.Task] = None
        self._lock = asyncio.Lock()

    # ── Internal helpers ───────────────────────────────────────────────────────

    async def _get_page_ws_url(self) -> Optional[str]:
        """Fetch the WebSocket debugger URL for the first page tab."""
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(
                    f"http://127.0.0.1:{self.port}/json",
                    timeout=aiohttp.ClientTimeout(total=3),
                ) as resp:
                    pages = await resp.json()
                    for page in pages:
                        if page.get("type") == "page":
                            url = page.get("webSocketDebuggerUrl")
                            if url:
                                return url
                    # Fallback: first entry regardless of type
                    if pages:
                        return pages[0].get("webSocketDebuggerUrl")
        except Exception as e:
            _LOGGER.debug("CDP /json fetch failed: %s", e)
        return None

    async def _recv_loop(self) -> None:
        """Continuously receive messages and dispatch to waiting futures."""
        try:
            assert self._ws is not None
            async for raw in self._ws:
                try:
                    data = json.loads(raw)
                    msg_id = data.get("id")
                    if msg_id and msg_id in self._pending:
                        fut = self._pending.pop(msg_id)
                        if not fut.done():
                            fut.set_result(data.get("result"))
                except Exception:
                    pass
        except Exception as e:
            _LOGGER.debug("CDP recv loop ended: %s", e)
        finally:
            # Cancel all pending futures
            for fut in self._pending.values():
                if not fut.done():
                    fut.cancel()
            self._pending.clear()

    async def _ensure_connected(self) -> bool:
        """Ensure we have an active WebSocket connection to Chromium."""
        if self._ws is not None and not self._ws.closed:
            return True

        ws_url = await self._get_page_ws_url()
        if not ws_url:
            return False

        try:
            self._ws = await websockets.connect(
                ws_url,
                ping_interval=None,
                open_timeout=5,
                close_timeout=5,
            )
            self._ws_url = ws_url
            # Start background receiver
            if self._recv_task and not self._recv_task.done():
                self._recv_task.cancel()
            loop = asyncio.get_event_loop()
            self._recv_task = loop.create_task(self._recv_loop())
            _LOGGER.debug("CDP WebSocket connected: %s", ws_url)
            return True
        except Exception as e:
            _LOGGER.debug("CDP WebSocket connect failed: %s", e)
            self._ws = None
            return False

    # ── Public API ─────────────────────────────────────────────────────────────

    async def send_cmd(self, method: str, params: Optional[Dict[str, Any]] = None, timeout: float = 15.0) -> Any:
        """Send a CDP command and wait for its result."""
        async with self._lock:
            if not await self._ensure_connected():
                _LOGGER.warning("CDP: not connected, cannot send %s", method)
                return None

        try:
            msg_id = self._msg_id
            self._msg_id += 1
            loop = asyncio.get_event_loop()
            fut: asyncio.Future = loop.create_future()
            self._pending[msg_id] = fut

            req = {"id": msg_id, "method": method, "params": params or {}}
            assert self._ws is not None
            await self._ws.send(json.dumps(req))

            try:
                result = await asyncio.wait_for(fut, timeout=timeout)
                return result
            except asyncio.TimeoutError:
                self._pending.pop(msg_id, None)
                _LOGGER.debug("CDP command %s timed out after %ss", method, timeout)
                return None
        except Exception as e:
            _LOGGER.debug("CDP command %s failed: %s", method, e)
            # Drop connection so next call reconnects
            self._ws = None
            return None

    async def reconnect_to_active_page(self) -> bool:
        """Force reconnect to the current active page (useful after navigation)."""
        # Close existing connection
        if self._ws and not self._ws.closed:
            try:
                await self._ws.close()
            except Exception:
                pass
        self._ws = None
        if self._recv_task and not self._recv_task.done():
            self._recv_task.cancel()
        self._pending.clear()

        # Wait a moment for the new page to register
        await asyncio.sleep(1.0)
        return await self._ensure_connected()

    async def wait_for_ready(self, timeout: float = 20.0, interval: float = 0.5) -> bool:
        """Poll CDP HTTP endpoint until Chromium is ready."""
        deadline = time.monotonic() + timeout
        while time.monotonic() < deadline:
            ws_url = await self._get_page_ws_url()
            if ws_url:
                _LOGGER.info("CDP ready")
                return True
            await asyncio.sleep(interval)
        return False
