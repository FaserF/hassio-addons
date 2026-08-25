import asyncio
import json
import logging
import ssl

import websockets

from .constants import USER_AGENT

_LOGGER = logging.getLogger(__name__)


async def verify_tr_token(token: str) -> bool:
    """Verify session token against Trade Republic WebSocket backend."""
    if not token:
        return False
    clean_token = token.strip().strip('"').strip("'")
    if clean_token.lower().startswith("bearer "):
        clean_token = clean_token[7:].strip()

    try:
        ssl_ctx = ssl.create_default_context()
        headers = {
            "User-Agent": USER_AGENT,
            "Origin": "https://app.traderepublic.com",
            "Authorization": f"Bearer {clean_token}",
            "Cookie": f"tr_session={clean_token}; tr_session_id={clean_token}; sessionToken={clean_token}",
        }
        ws = await websockets.connect(
            "wss://api.traderepublic.com",
            ssl=ssl_ctx,
            additional_headers=headers,
        )

        try:
            async with asyncio.timeout(6):
                handshake = {
                    "locale": "de",
                    "platformId": "web",
                    "appVersion": "4.120.0",
                    "osVersion": "10.0.0",
                    "token": clean_token,
                }
                await ws.send("connect 26 " + json.dumps(handshake))
                resp = await ws.recv()
                _LOGGER.info("Token validation handshake response: %s", resp)
                if not resp or ("connected" not in str(resp) and "26" not in str(resp)):
                    return False

                # Test actual data subscription with response loop
                await ws.send('sub 1 {"type":"compactPortfolioByType"}')
                start_t = asyncio.get_event_loop().time()
                while asyncio.get_event_loop().time() - start_t < 4.0:
                    sub_resp = await ws.recv()
                    if not sub_resp:
                        continue
                    _LOGGER.info("Token subscription test response: %s", sub_resp)
                    parts = str(sub_resp).split(" ", 2)
                    if len(parts) >= 2:
                        sub_id_str, status = parts[0], parts[1]
                        if sub_id_str == "1":
                            if status == "A":
                                return True
                            if status == "E":
                                _LOGGER.warning("Token subscription rejected with error: %s", sub_resp)
                                return False
                return True
        finally:
            await ws.close()

    except Exception as e:
        _LOGGER.warning("Token validation failed with error: %s", e)
        return False
