import asyncio
import json
import logging
import os
from contextlib import asynccontextmanager
from typing import Any, Optional

import aiohttp
from browser import browser_service
from fastapi import FastAPI, HTTPException, Request, Security
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.security.api_key import APIKeyHeader
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from pydantic import BaseModel

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
_LOGGER = logging.getLogger("traderepublic-addon")

# ── Supervisor token auth ─────────────────────────────────────────────────────
_SUPERVISOR_TOKEN = os.getenv("SUPERVISOR_TOKEN", "")
_api_key_header = APIKeyHeader(name="Authorization", auto_error=False)


async def require_supervisor_auth(
    request: Request,
    authorization: Optional[str] = Security(_api_key_header),
) -> None:
    """Require valid auth: allow Home Assistant container subnet (172.30.32.0/23, 127.0.0.1) or valid Bearer token."""
    client_ip = request.client.host if request.client else ""

    # 1. Allow local loopback and standard Home Assistant docker internal subnets
    if client_ip in ("127.0.0.1", "::1", "localhost") or client_ip.startswith("172.30.") or client_ip.startswith("172.17."):
        return

    # 2. Check Bearer Supervisor Token
    if _SUPERVISOR_TOKEN:
        expected = f"Bearer {_SUPERVISOR_TOKEN}"
        if authorization and authorization == expected:
            return

    # 3. Check Ingress header if forwarded by Home Assistant Ingress
    if request.headers.get("X-Ingress-Path") or request.headers.get("x-ingress-path"):
        return

    raise HTTPException(status_code=403, detail="Forbidden: internal network or valid authorization required")


@asynccontextmanager
async def lifespan(app: FastAPI):
    _LOGGER.info("Starting Trade Republic Browser Engine...")
    await browser_service.start()
    asyncio.create_task(register_supervisor_discovery())
    yield
    _LOGGER.info("Stopping Trade Republic Browser Engine...")
    await browser_service.close()


async def register_supervisor_discovery() -> None:
    """Register service with Home Assistant Supervisor discovery endpoint if running as Add-on."""
    supervisor_token = os.getenv("SUPERVISOR_TOKEN")
    if not supervisor_token:
        _LOGGER.debug("No SUPERVISOR_TOKEN found, running outside Supervisor")
        return

    port = int(os.getenv("PORT", "8095"))
    headers = {
        "Authorization": f"Bearer {supervisor_token}",
        "Content-Type": "application/json",
    }
    payload = {
        "service": "traderepublic",
        "config": {
            "host": "traderepublic",
            "port": port,
        },
    }
    for attempt in range(10):
        await asyncio.sleep(5)
        try:
            async with (
                aiohttp.ClientSession() as session,
                session.post(
                    "http://supervisor/discovery",
                    json=payload,
                    headers=headers,
                    timeout=aiohttp.ClientTimeout(total=5),
                ) as resp,
            ):
                if resp.status in (200, 201):
                    _LOGGER.info("Successfully registered Trade Republic discovery with Supervisor")
                    break
                resp_txt = await resp.text()
                _LOGGER.debug("Supervisor discovery response (attempt %s) [%s]: %s", attempt + 1, resp.status, resp_txt)
        except Exception as exc:
            _LOGGER.debug("Could not notify Supervisor discovery (attempt %s): %s", attempt + 1, exc)


app = FastAPI(title="Trade Republic Headless Browser Session Provider", lifespan=lifespan)


@app.middleware("http")
async def ingress_middleware(request: Request, call_next):
    """Handle Home Assistant Ingress dynamic subpath prefix and normalize slashes."""
    import re

    path = request.scope.get("path", "/")
    # Normalize double slashes from HA Ingress proxies (e.g. //)
    path = re.sub(r"/+", "/", path)

    ingress_path = request.headers.get("x-ingress-path")
    if ingress_path:
        clean_prefix = re.sub(r"/+", "/", ingress_path).rstrip("/")
        if clean_prefix and path.startswith(clean_prefix):
            path = path[len(clean_prefix) :] or "/"
            path = re.sub(r"/+", "/", path)

    request.scope["path"] = path or "/"
    response = await call_next(request)
    return response


templates = Jinja2Templates(directory="templates" if os.path.exists("templates") else "/opt/traderepublic/templates")
static_dir = "static" if os.path.exists("static") else "/opt/traderepublic/static"
if os.path.exists(static_dir):
    app.mount("/static", StaticFiles(directory=static_dir), name="static")


class LoginInitRequest(BaseModel):
    phone_number: str
    pin: str


class VerifyRequest(BaseModel):
    code: str


class ManualTokenRequest(BaseModel):
    session_token: str
    phone_number: Optional[str] = None


@app.get("", response_class=HTMLResponse)
@app.get("/", response_class=HTMLResponse)
@app.get("//", response_class=HTMLResponse)
async def get_index(request: Request):
    import time

    last_sync_sec = None
    if browser_service.last_sync_time:
        last_sync_sec = int(time.time() - browser_service.last_sync_time)

    all_i18n: dict[str, Any] = {}
    i18n_dir = os.path.join(static_dir, "i18n")
    if os.path.exists(i18n_dir):
        for lang_file in os.listdir(i18n_dir):
            if lang_file.endswith(".json"):
                lang_code = lang_file[:-5]
                try:
                    with open(os.path.join(i18n_dir, lang_file), "r", encoding="utf-8") as f:
                        all_i18n[lang_code] = json.load(f)
                except Exception:  # noqa: BLE001
                    pass

    return templates.TemplateResponse(
        request=request,
        name="index.html",
        context={
            "is_logged_in": browser_service.is_logged_in,
            "phone_number": browser_service.phone_number or "Not configured",
            "has_token": bool(browser_service.session_token),
            "status_message": browser_service.status_message,
            "last_error": browser_service.last_error,
            "requests_count": browser_service.client_requests_count,
            "last_sync_sec": last_sync_sec,
            "all_i18n": json.dumps(all_i18n),
        },
    )


@app.get("/api/v1/status")
async def get_status():
    return {
        "status": "online",
        "service": "traderepublic-addon",
        "is_logged_in": browser_service.is_logged_in,
        "has_session": bool(browser_service.session_token),
        "phone_number": browser_service.phone_number,
        "message": browser_service.status_message,
        "last_error": browser_service.last_error,
        "requests_count": browser_service.client_requests_count,
        "last_sync_time": browser_service.last_sync_time,
    }


@app.get("/api/v1/session", dependencies=[Security(require_supervisor_auth)])
async def get_session():
    import time

    browser_service.client_requests_count += 1
    browser_service.last_sync_time = time.time()
    if not browser_service.session_token:
        return JSONResponse(status_code=404, content={"error": "No active session token available"})
    return {
        "session_token": browser_service.session_token,
        "phone_number": browser_service.phone_number,
        "is_logged_in": browser_service.is_logged_in,
        "token_verified": bool(browser_service.token_verified_at),
        "token_verified_at": browser_service.token_verified_at,
    }


@app.post("/api/v1/session/manual", dependencies=[Security(require_supervisor_auth)])
async def set_manual_session(req: ManualTokenRequest):
    await browser_service.save_session(req.session_token, req.phone_number)
    return {"success": True, "message": "Session token saved successfully"}


@app.post("/api/v1/login/init")
async def post_login_init(req: LoginInitRequest):
    result = await browser_service.start_login(req.phone_number, req.pin)
    return result


@app.post("/api/v1/login/verify")
async def post_login_verify(req: VerifyRequest):
    import time

    result = await browser_service.submit_2fa(req.code)
    if result.get("success"):
        browser_service.client_requests_count += 1
        browser_service.last_sync_time = time.time()
    return result


@app.post("/api/v1/refresh", dependencies=[Security(require_supervisor_auth)])
async def post_refresh():
    token = await browser_service.refresh_session()
    return {"success": bool(token), "session_token": token}


@app.post("/api/v1/session/check")
async def post_check_session():
    if not browser_service.session_token:
        return {"success": False, "valid": False, "message": "No active session token available."}
    is_valid = await browser_service.verify_token_validity(browser_service.session_token)
    browser_service.is_logged_in = is_valid
    if is_valid:
        browser_service.status_message = "Everything is connected and running normally."
        browser_service.last_error = None
        return {"success": True, "valid": True, "message": "Session token is valid and active!"}
    browser_service.status_message = "Session token expired. Please re-authenticate."
    browser_service.last_error = "Session expired or rejected by Trade Republic (HTTP 401). Please re-authenticate."
    return {"success": True, "valid": False, "message": "Session token has expired or is invalid."}


if __name__ == "__main__":
    import uvicorn

    port = int(os.getenv("PORT", "8095"))
    uvicorn.run("main:app", host="0.0.0.0", port=port, log_level="info")
