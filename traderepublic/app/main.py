import logging
import os
from contextlib import asynccontextmanager
from typing import Optional

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
    yield
    _LOGGER.info("Stopping Trade Republic Browser Engine...")
    await browser_service.close()


app = FastAPI(title="Trade Republic Headless Browser Session Provider", lifespan=lifespan)


@app.middleware("http")
async def ingress_middleware(request: Request, call_next):
    """Handle Home Assistant Ingress dynamic subpath prefix."""
    ingress_path = request.headers.get("x-ingress-path")
    if ingress_path:
        path = request.scope.get("path", "/")
        clean_prefix = ingress_path.rstrip("/")
        if path.startswith(clean_prefix):
            path = path[len(clean_prefix) :] or "/"
            request.scope["path"] = path
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


@app.get("/", response_class=HTMLResponse)
async def get_index(request: Request):
    return templates.TemplateResponse(
        "index.html",
        {
            "request": request,
            "is_logged_in": browser_service.is_logged_in,
            "phone_number": browser_service.phone_number or "Not configured",
            "has_token": bool(browser_service.session_token),
            "status_message": browser_service.status_message,
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
    }


@app.get("/api/v1/session")
async def get_session():
    if not browser_service.session_token:
        return JSONResponse(status_code=404, content={"error": "No active session token available"})
    return {
        "session_token": browser_service.session_token,
        "phone_number": browser_service.phone_number,
        "is_logged_in": browser_service.is_logged_in,
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


if __name__ == "__main__":
    import uvicorn

    port = int(os.getenv("PORT", "8095"))
    uvicorn.run("main:app", host="0.0.0.0", port=port, log_level="info")
