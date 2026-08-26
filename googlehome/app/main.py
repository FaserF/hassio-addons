import asyncio
import json
import logging
import os
import time
from contextlib import asynccontextmanager
from typing import Optional

import aiohttp
from fastapi import FastAPI, HTTPException, Request, Security
from fastapi.responses import HTMLResponse
from fastapi.security.api_key import APIKeyHeader
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from pydantic import BaseModel

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
_LOGGER = logging.getLogger("googlehome-addon")

_SUPERVISOR_TOKEN = os.getenv("SUPERVISOR_TOKEN", "")
_api_key_header = APIKeyHeader(name="Authorization", auto_error=False)

DATA_DIR = os.getenv("DATA_DIR", "/data")
SESSION_FILE = os.path.join(DATA_DIR, "session.json")


def get_addon_version() -> str:
    """Retrieve the current Google Home add-on version dynamically from Supervisor."""
    supervisor_token = os.getenv("SUPERVISOR_TOKEN")
    if supervisor_token:
        try:
            import urllib.request

            req = urllib.request.Request(
                "http://supervisor/addons/self/info",
                headers={"Authorization": f"Bearer {supervisor_token}"},
            )
            with urllib.request.urlopen(req, timeout=1.5) as resp:
                if resp.status == 200:
                    data = json.loads(resp.read().decode("utf-8"))
                    v = (data.get("data") or {}).get("version")
                    if v and str(v).strip() not in ("unknown", "0.1.0", ""):
                        return str(v).strip()
        except Exception:
            pass

    dynamic_ver = os.getenv("ADDON_VERSION")
    if dynamic_ver and dynamic_ver.strip() not in ("unknown", "0.1.0", "1.0.0", ""):
        return dynamic_ver.strip()

    env_ver = os.getenv("APP_VERSION")
    if env_ver and env_ver.strip() not in ("unknown", "0.1.0", "1.0.0", ""):
        return env_ver.strip()

    for path in [
        "/opt/googlehome/config.yaml",
        "config.yaml",
        "/config.yaml",
        os.path.join(os.path.dirname(__file__), "..", "config.yaml"),
    ]:
        if os.path.exists(path):
            try:
                with open(path, "r", encoding="utf-8") as f:
                    for line in f:
                        if line.startswith("version:"):
                            parsed = line.split(":", 1)[1].strip().strip('"').strip("'")
                            if parsed and parsed != "1.0.0":
                                return parsed
            except Exception:
                pass

    return env_ver.strip() if env_ver else (dynamic_ver.strip() if dynamic_ver else "0.1.0")


def get_integration_version() -> str:
    """Retrieve locally installed Google Home custom integration version."""
    ha_cfg = os.getenv("HA_CONFIG_ROOT", "/config")
    candidates = [
        os.path.join(ha_cfg, "custom_components", "google_home", "manifest.json"),
        "/config/custom_components/google_home/manifest.json",
        "/homeassistant/custom_components/google_home/manifest.json",
        "custom_components/google_home/manifest.json",
        "../ha-googlehome/custom_components/google_home/manifest.json",
        os.path.join(
            os.path.dirname(__file__),
            "..",
            "..",
            "ha-googlehome",
            "custom_components",
            "google_home",
            "manifest.json",
        ),
    ]
    for path in candidates:
        if os.path.exists(path):
            try:
                with open(path, "r", encoding="utf-8") as f:
                    manifest = json.load(f)
                    ver = manifest.get("version")
                    if ver:
                        return str(ver).strip()
            except Exception:
                pass
    return "1.0.0"


class TokenState:
    def __init__(self) -> None:
        self.email: Optional[str] = None
        self.master_token: Optional[str] = None
        self.status: str = "Ready for token input"
        self.last_error: Optional[str] = None
        self.requests_count: int = 0
        self.last_sync_time: Optional[float] = None
        self.request_counts_by_type: dict[str, int] = {"session": 0, "login": 0, "status": 0}
        self.last_interaction_type: str = "None"
        self.last_interaction_details: str = "No requests recorded yet"
        self.load()

    def load(self) -> None:
        if os.path.exists(SESSION_FILE):
            try:
                with open(SESSION_FILE, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    self.email = data.get("email")
                    self.master_token = data.get("master_token")
                    if self.master_token:
                        self.status = "Master Token active and linked"
            except Exception as err:
                _LOGGER.warning("Could not load session.json: %s", err)

    def save(self) -> None:
        os.makedirs(DATA_DIR, exist_ok=True)
        try:
            with open(SESSION_FILE, "w", encoding="utf-8") as f:
                json.dump(
                    {
                        "email": self.email,
                        "master_token": self.master_token,
                    },
                    f,
                    indent=2,
                )
        except Exception as err:
            _LOGGER.error("Error saving session: %s", err)

    def record_interaction(self, itype: str, details: str = "") -> None:
        self.requests_count += 1
        self.last_sync_time = time.time()
        self.request_counts_by_type[itype] = self.request_counts_by_type.get(itype, 0) + 1
        self.last_interaction_type = itype
        self.last_interaction_details = details

    def clear(self) -> None:
        self.email = None
        self.master_token = None
        self.status = "Ready for token input"
        self.last_error = None
        if os.path.exists(SESSION_FILE):
            try:
                os.remove(SESSION_FILE)
            except Exception:
                pass


state = TokenState()


async def require_auth(
    request: Request,
    authorization: Optional[str] = Security(_api_key_header),
) -> None:
    client_ip = request.client.host if request.client else ""
    if (
        client_ip in ("127.0.0.1", "::1", "localhost")
        or client_ip.startswith("172.30.")
        or client_ip.startswith("172.17.")
    ):
        return

    if _SUPERVISOR_TOKEN and authorization == f"Bearer {_SUPERVISOR_TOKEN}":
        return

    if request.headers.get("X-Ingress-Path") or request.headers.get("x-ingress-path"):
        return

    raise HTTPException(status_code=403, detail="Forbidden: Internal network or Ingress required")


@asynccontextmanager
async def lifespan(app: FastAPI):
    _LOGGER.info("Starting Google Home Token Hub...")
    asyncio.create_task(register_supervisor_discovery())
    asyncio.create_task(browser_service.start_chromium())
    yield


async def register_supervisor_discovery() -> None:
    supervisor_token = os.getenv("SUPERVISOR_TOKEN")
    if not supervisor_token:
        _LOGGER.debug("No SUPERVISOR_TOKEN found, running standalone")
        return

    port = int(os.getenv("PORT", "8195"))
    headers = {
        "Authorization": f"Bearer {supervisor_token}",
        "Content-Type": "application/json",
    }
    payload = {
        "service": "googlehome",
        "config": {
            "host": "googlehome",
            "port": port,
        },
    }
    for _ in range(5):
        await asyncio.sleep(4)
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
                    _LOGGER.info("Successfully announced service to Home Assistant Supervisor!")
                    break
        except Exception as err:
            _LOGGER.debug("Discovery announce retry: %s", err)


app = FastAPI(title="Google Home Token Hub", lifespan=lifespan)


@app.middleware("http")
async def ingress_middleware(request: Request, call_next):
    """Handle Home Assistant Ingress dynamic subpath prefix and normalize slashes."""
    import re

    path = request.scope.get("path", "/")
    path = re.sub(r"/+", "/", path)

    ingress_path = request.headers.get("x-ingress-path") or request.headers.get("X-Ingress-Path")
    if ingress_path:
        clean_prefix = re.sub(r"/+", "/", ingress_path).rstrip("/")
        if clean_prefix and path.startswith(clean_prefix):
            path = path[len(clean_prefix) :] or "/"
            path = re.sub(r"/+", "/", path)

    request.scope["path"] = path or "/"
    response = await call_next(request)
    return response


template_dir = (
    os.path.join(os.path.dirname(__file__), "templates")
    if os.path.exists(os.path.join(os.path.dirname(__file__), "templates"))
    else ("/opt/googlehome/app/templates" if os.path.exists("/opt/googlehome/app/templates") else "templates")
)
templates = Jinja2Templates(directory=template_dir)

static_dir = (
    os.path.join(os.path.dirname(__file__), "static")
    if os.path.exists(os.path.join(os.path.dirname(__file__), "static"))
    else ("/opt/googlehome/app/static" if os.path.exists("/opt/googlehome/app/static") else "static")
)
if os.path.exists(static_dir):
    app.mount("/static", StaticFiles(directory=static_dir), name="static")


class LoginRequest(BaseModel):
    email: str
    password: Optional[str] = None
    token: Optional[str] = None


@app.get("/", response_class=HTMLResponse)
@app.get("", response_class=HTMLResponse)
@app.get("/index.html", response_class=HTMLResponse)
async def get_index(request: Request):
    root_path = (request.headers.get("X-Ingress-Path") or request.headers.get("x-ingress-path") or "").rstrip("/")
    addon_ver = get_addon_version()
    int_ver = get_integration_version()

    last_sync_str = "—"
    if state.last_sync_time:
        diff = int(time.time() - state.last_sync_time)
        if diff < 5:
            last_sync_str = "Just now"
        elif diff < 60:
            last_sync_str = f"{diff}s ago"
        elif diff < 3600:
            last_sync_str = f"{diff // 60}m ago"
        else:
            last_sync_str = f"{diff // 3600}h ago"

    return templates.TemplateResponse(
        request=request,
        name="index.html",
        context={
            "root_path": root_path,
            "addon_version": addon_ver,
            "integration_version": int_ver,
            "email": state.email or "",
            "master_token": state.master_token or "",
            "is_logged_in": bool(state.master_token),
            "status": state.status,
            "last_error": state.last_error,
            "requests_count": state.requests_count,
            "last_sync": last_sync_str,
            "request_counts_by_type": state.request_counts_by_type,
            "last_interaction_type": state.last_interaction_type,
            "last_interaction_details": state.last_interaction_details,
        },
    )


try:
    from .core.browser_service import GoogleHomeBrowserService
except ImportError:
    from core.browser_service import GoogleHomeBrowserService

browser_service = GoogleHomeBrowserService()


def on_token_acquired(email: str, master_token: str) -> None:
    state.email = email
    state.master_token = master_token
    state.status = "Google Account & 2FA successfully linked"
    state.last_error = None
    state.record_interaction("login", "Headless 2FA login successful")
    state.save()


browser_service.set_on_success_callback(on_token_acquired)


class TwoFactorRequest(BaseModel):
    code: str


@app.post("/api/auth/start")
@app.post("/api/v1/auth/start")
@app.post("/api/login", dependencies=[Security(require_auth)])
@app.post("/api/v1/login", dependencies=[Security(require_auth)])
async def post_login(req: LoginRequest):
    email = req.email.strip()
    raw_token = (req.token or "").strip()
    password = (req.password or "").strip()

    if not email or "@" not in email or "." not in email:
        raise HTTPException(
            status_code=400,
            detail="Please enter a valid Google email address (e.g. name@gmail.com).",
        )

    if raw_token:
        if raw_token.startswith("oauth_token="):
            raw_token = raw_token.split("oauth_token=")[1].split(";")[0].strip()
        if not raw_token.startswith("aas_et/") and not raw_token.startswith("oauth2_4/"):
            raise HTTPException(
                status_code=400,
                detail="Invalid token format. The token must start with 'aas_et/' (Master Token) or 'oauth2_4/' (Web OAuth Token).",
            )

        if raw_token.startswith("aas_et/"):
            on_token_acquired(email, raw_token)
            return {"success": True, "master_token": raw_token, "step": "success"}

        try:
            from gpsoauth import exchange_token

            res = exchange_token(email, raw_token, "android-701ab861a7be")
            if "Token" in res:
                master_token = res["Token"]
                on_token_acquired(email, master_token)
                return {"success": True, "master_token": master_token, "step": "success"}
            else:
                err_msg = res.get("Error", "Unknown")
                state.last_error = f"Google Token error: {err_msg}"
                state.record_interaction("login", f"Failed: {err_msg}")
                raise HTTPException(status_code=400, detail=state.last_error)
        except HTTPException:
            raise
        except Exception as err:
            state.last_error = str(err)
            state.record_interaction("login", f"Exception: {err}")
            raise HTTPException(status_code=500, detail=f"Error: {err}")

    if password:
        # 1. Fast path: try direct master login (works instantly for App Passwords)
        try:
            from gpsoauth import perform_master_login

            res = perform_master_login(email, password, "android-701ab861a7be")
            if "Token" in res:
                master_token = res["Token"]
                on_token_acquired(email, master_token)
                return {"success": True, "master_token": master_token, "step": "success"}
        except Exception:
            pass

        # 2. Automated 2FA path: launch headless browser for EmbeddedSetup
        await browser_service.start_auth_flow(email, password)
        return {
            "success": False,
            "requires_2fa": True,
            "step": browser_service.auth_step,
            "message": "Automated 2FA login started in background browser",
        }

    raise HTTPException(status_code=400, detail="Please provide either a password or a token")


@app.get("/api/auth/status")
@app.get("/api/v1/auth/status")
async def get_auth_status():
    return {
        "in_progress": browser_service.auth_in_progress,
        "step": browser_service.auth_step,
        "error": browser_service.auth_error,
        "two_factor": browser_service.two_factor_data,
        "is_logged_in": bool(state.master_token),
        "email": state.email,
        "master_token": state.master_token,
    }


@app.post("/api/auth/2fa")
@app.post("/api/v1/auth/2fa")
async def post_auth_2fa(req: TwoFactorRequest):
    if not browser_service.auth_in_progress:
        raise HTTPException(status_code=400, detail="No active authentication in progress")
    res = await browser_service.submit_2fa_code(req.code)
    return {"success": res, "step": browser_service.auth_step}


@app.post("/api/auth/cancel")
@app.post("/api/v1/auth/cancel")
async def post_auth_cancel():
    await browser_service.cancel_auth()
    return {"success": True}


@app.get("/api/debug/chromium-log")
async def get_chromium_log():
    """Return last 100 lines of Chromium stderr log for diagnosis."""
    log_path = os.path.join(DATA_DIR, "chromium_stderr.log")
    if not os.path.exists(log_path):
        return {"lines": [], "message": "No Chromium log file yet"}
    try:
        with open(log_path, "r", errors="replace") as f:
            lines = f.readlines()
        return {"lines": lines[-100:], "total_lines": len(lines)}
    except Exception as err:
        return {"error": str(err)}


@app.get("/api/v1/session", dependencies=[Security(require_auth)])
@app.get("/api/session", dependencies=[Security(require_auth)])
async def get_session():
    state.record_interaction("session", "Session polled by Home Assistant")
    return {
        "email": state.email,
        "master_token": state.master_token,
        "is_logged_in": bool(state.master_token),
        "status": state.status,
        "last_error": state.last_error,
        "requests_count": state.requests_count,
        "last_sync_time": state.last_sync_time,
        "addon_version": get_addon_version(),
        "integration_version": get_integration_version(),
    }


@app.get("/api/v1/status", dependencies=[Security(require_auth)])
@app.get("/api/status", dependencies=[Security(require_auth)])
async def get_status():
    state.record_interaction("status", "Status polled by client")
    return {
        "email": state.email,
        "master_token": state.master_token,
        "is_logged_in": bool(state.master_token),
        "status": state.status,
        "last_error": state.last_error,
        "requests_count": state.requests_count,
        "last_sync_time": state.last_sync_time,
        "request_counts_by_type": state.request_counts_by_type,
        "last_interaction_type": state.last_interaction_type,
        "last_interaction_details": state.last_interaction_details,
        "addon_version": get_addon_version(),
        "integration_version": get_integration_version(),
    }


@app.post("/api/v1/logout", dependencies=[Security(require_auth)])
@app.post("/api/logout", dependencies=[Security(require_auth)])
async def post_logout():
    state.clear()
    state.record_interaction("logout", "Session cleared by user")
    return {"success": True, "message": "Session successfully cleared"}
