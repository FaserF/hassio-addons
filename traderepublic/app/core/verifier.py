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
                if not resp or ("connected" not in str(resp) and "26" not in str(resp)):
                    return False

                # Test actual data subscription
                await ws.send('sub 1 {"type":"compactPortfolioByType"}')
                sub_resp = await ws.recv()
                _LOGGER.info("Token subscription test response: %s", sub_resp)
                if sub_resp:
                    parts = str(sub_resp).split(" ", 2)
                    if len(parts) >= 2 and parts[1] == "E":
                        _LOGGER.warning("Token subscription rejected with error: %s", sub_resp)
                        return False
                    return True
                return False
        finally:
            await ws.close()

    except Exception as e:
        err_str = str(e).lower()
        # 401 = definitely invalid token
        if "401" in err_str or "unauth" in err_str or "rejected" in err_str:
            _LOGGER.warning("Token validation rejected by Trade Republic: %s", e)
            return False
        # Network/timeout errors = inconclusive, assume still valid to avoid false expiry
        _LOGGER.debug("Token validation network error (assuming still valid): %s", e)
        return True
