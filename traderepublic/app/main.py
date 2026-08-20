import asyncio
import logging
import os
from contextlib import asynccontextmanager
from typing import Optional

import aiohttp
from browser import browser_service
from fastapi import FastAPI, Request
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from pydantic import BaseModel

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
_LOGGER = logging.getLogger("traderepublic-addon")


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
if os.path.exists("static"):
    app.mount("/static", StaticFiles(directory="static"), name="static")


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

    last_seen_str = "Never"
    if browser_service.last_sync_time:
        diff_sec = int(time.time() - browser_service.last_sync_time)
        if diff_sec < 60:
            last_seen_str = f"{diff_sec}s ago"
        elif diff_sec < 3600:
            last_seen_str = f"{diff_sec // 60}m ago"
        else:
            last_seen_str = f"{diff_sec // 3600}h ago"

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
            "last_sync": last_seen_str,
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


@app.get("/api/v1/session")
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


@app.post("/api/v1/session/manual")
async def set_manual_session(req: ManualTokenRequest):
    await browser_service.save_session(req.session_token, req.phone_number)
    return {"success": True, "message": "Session token saved successfully"}


@app.post("/api/v1/login/init")
async def post_login_init(req: LoginInitRequest):
    result = await browser_service.start_login(req.phone_number, req.pin)
    return result


@app.post("/api/v1/login/verify")
async def post_login_verify(req: VerifyRequest):
    result = await browser_service.submit_2fa(req.code)
    return result


@app.post("/api/v1/refresh")
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
