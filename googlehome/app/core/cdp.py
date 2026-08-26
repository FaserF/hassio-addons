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
    """Client to communicate with Headless Chromium via Chrome DevTools Protocol."""

    def __init__(self, port: int = CDP_PORT) -> None:
        self.port = port

    async def send_cmd(self, method: str, params: Optional[Dict[str, Any]] = None) -> Any:
        """Send command via Chrome DevTools Protocol."""
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(
                    f"http://127.0.0.1:{self.port}/json", timeout=aiohttp.ClientTimeout(total=2)
                ) as resp:
                    pages = await resp.json()
                    if not pages:
                        return None
                    ws_url = pages[0].get("webSocketDebuggerUrl")
                    if not ws_url:
                        return None

            async with websockets.connect(ws_url) as ws:
                msg_id = int(time.time() * 1000) % 100000
                req = {"id": msg_id, "method": method, "params": params or {}}
                await ws.send(json.dumps(req))
                while True:
                    raw = await ws.recv()
                    data = json.loads(raw)
                    if data.get("id") == msg_id:
                        return data.get("result")
        except Exception as e:
            _LOGGER.debug("CDP command %s failed: %s", method, e)
            return None

    async def wait_for_ready(self, timeout: float = 15.0, interval: float = 0.5) -> bool:
        """Poll CDP HTTP endpoint until Chromium is ready."""
        deadline = time.monotonic() + timeout
        attempt = 0
        while time.monotonic() < deadline:
            try:
                async with aiohttp.ClientSession() as session:
                    async with session.get(
                        f"http://127.0.0.1:{self.port}/json",
                        timeout=aiohttp.ClientTimeout(total=2),
                    ) as resp:
                        pages = await resp.json()
                        if pages and pages[0].get("webSocketDebuggerUrl"):
                            _LOGGER.info("CDP ready")
                            return True
            except Exception:
                pass
            attempt += 1
            await asyncio.sleep(interval)
        return False
