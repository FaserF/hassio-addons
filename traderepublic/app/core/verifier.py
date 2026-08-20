import asyncio
import json
import logging
import ssl

import websockets

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
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
            "Origin": "https://app.traderepublic.com",
            "Cookie": f"tr_session={clean_token}; tr_session_id={clean_token}; sessionToken={clean_token}",
        }
        try:
            ws = await websockets.connect(
                "wss://api.traderepublic.com",
                ssl=ssl_ctx,
                additional_headers=headers,
            )
        except Exception as first_exc:
            if clean_token and ("401" in str(first_exc) or getattr(first_exc, "status_code", None) == 401):
                auth_headers = {
                    "User-Agent": headers["User-Agent"],
                    "Origin": headers["Origin"],
                    "Authorization": f"Bearer {clean_token}",
                    "Cookie": headers.get("Cookie", ""),
                }
                ws = await websockets.connect(
                    "wss://api.traderepublic.com",
                    ssl=ssl_ctx,
                    additional_headers=auth_headers,
                )
            else:
                raise

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
                if resp and ("connected" in str(resp) or "26" in str(resp)):
                    return True
                return False
        finally:
            await ws.close()

    except Exception as e:
        _LOGGER.warning("Token validation check error: %s", e)
        return False
