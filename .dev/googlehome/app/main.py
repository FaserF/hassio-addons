import asyncio
import json
import logging
import os
import time
from contextlib import asynccontextmanager
from typing import Any, Optional

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


def get_addon_options() -> dict:
    """Read add-on configuration options from /data/options.json."""
    options_path = os.path.join(DATA_DIR, "options.json")
    if os.path.exists(options_path):
        try:
            with open(options_path, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception as err:
            _LOGGER.warning("Could not read options.json: %s", err)
    return {}


def get_auto_stop_timeout_minutes() -> int:
    """Retrieve auto-stop timeout in minutes (default 60, 0 to disable)."""
    env_val = os.getenv("AUTO_STOP_TIMEOUT")
    if env_val and env_val.isdigit():
        return int(env_val)
    options = get_addon_options()
    val = options.get("auto_stop_timeout")
    if val is not None:
        try:
            return int(val)
        except (ValueError, TypeError):
            pass
    return 60


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


INTEGRATION_SPECS = {
    "google_home": {
        "slug": "google_home",
        "name": "ha-googlehome",
        "title": "Google Home",
        "category": "Speakers & Displays",
        "repo": "FaserF/ha-googlehome",
        "folder": "google_home",
        "manifest_slug": "google_home",
        "hacs_url": "https://my.home-assistant.io/redirect/hacs_repository/?owner=FaserF&repository=ha-googlehome&category=integration",
        "github_url": "https://github.com/FaserF/ha-googlehome",
    },
    "googlefindmy": {
        "slug": "googlefindmy",
        "name": "GoogleFindMy-HA",
        "title": "Google Find My Device",
        "category": "Trackers & Tags",
        "repo": "BSkando/GoogleFindMy-HA",
        "folder": "googlefindmy",
        "manifest_slug": "googlefindmy",
        "hacs_url": "https://my.home-assistant.io/redirect/hacs_repository/?owner=BSkando&repository=GoogleFindMy-HA&category=integration",
        "github_url": "https://github.com/BSkando/GoogleFindMy-HA",
    },
}

_GITHUB_CACHE: dict[str, dict[str, Any]] = {}
_LAST_ACTIVITY_TIME: float = time.time()
INSTALL_STATE_FILE = os.path.join(DATA_DIR, "install_state.json")


def update_activity_timestamp() -> None:
    """Record user/API activity to reset the auto-stop inactivity timer."""
    global _LAST_ACTIVITY_TIME
    _LAST_ACTIVITY_TIME = time.time()


def get_pending_restart_state() -> dict[str, Any]:
    """Check if an integration install/update occurred and Home Assistant core hasn't restarted yet."""
    if not os.path.exists(INSTALL_STATE_FILE):
        return {"restart_required": False, "pending_integrations": []}
    try:
        with open(INSTALL_STATE_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
            return data
    except Exception:
        return {"restart_required": False, "pending_integrations": []}


def set_pending_restart_state(integration_slug: str) -> None:
    """Mark an integration as installed/updated pending Home Assistant restart."""
    os.makedirs(DATA_DIR, exist_ok=True)
    state_data = get_pending_restart_state()
    state_data["restart_required"] = True
    pending = set(state_data.get("pending_integrations", []))
    pending.add(integration_slug)
    state_data["pending_integrations"] = list(pending)
    state_data["updated_at"] = time.time()
    try:
        with open(INSTALL_STATE_FILE, "w", encoding="utf-8") as f:
            json.dump(state_data, f, indent=2)
    except Exception as err:
        _LOGGER.warning("Could not save install state: %s", err)


def clear_pending_restart_state() -> None:
    """Clear restart required flag."""
    if os.path.exists(INSTALL_STATE_FILE):
        try:
            os.remove(INSTALL_STATE_FILE)
        except Exception:
            pass


def get_installed_integration_manifest(slug: str) -> Optional[dict]:
    """Retrieve parsed manifest.json for an installed integration if present."""
    ha_cfg = os.getenv("HA_CONFIG_ROOT", "/config")
    folder = INTEGRATION_SPECS.get(slug, {}).get("folder", slug)
    candidates = [
        os.path.join(ha_cfg, "custom_components", folder, "manifest.json"),
        f"/config/custom_components/{folder}/manifest.json",
        f"/homeassistant/custom_components/{folder}/manifest.json",
        f"custom_components/{folder}/manifest.json",
        os.path.join(os.path.dirname(__file__), "..", "..", folder, "custom_components", folder, "manifest.json"),
    ]
    for path in candidates:
        if os.path.exists(path):
            try:
                with open(path, "r", encoding="utf-8") as f:
                    return json.load(f)
            except Exception as err:
                _LOGGER.debug("Error reading %s: %s", path, err)
    return None


def get_integration_version(slug: str = "google_home") -> Optional[str]:
    """Retrieve locally installed integration version."""
    manifest = get_installed_integration_manifest(slug)
    if manifest and manifest.get("version"):
        return str(manifest.get("version")).strip()
    return None


async def fetch_latest_github_release(repo: str) -> Optional[str]:
    """Fetch latest release tag from GitHub API with in-memory caching."""
    now = time.time()
    cached = _GITHUB_CACHE.get(repo)
    if cached and (now - cached.get("timestamp", 0) < 900):  # 15 minutes cache
        return cached.get("version")

    headers = {
        "User-Agent": "HomeAssistant-GoogleHome-Addon",
        "Accept": "application/vnd.github.v3+json",
    }
    gh_token = os.getenv("GITHUB_TOKEN") or get_addon_options().get("github_token")
    if gh_token:
        headers["Authorization"] = f"Bearer {gh_token}"

    url = f"https://api.github.com/repos/{repo}/releases/latest"
    try:
        async with (
            aiohttp.ClientSession() as session,
            session.get(url, headers=headers, timeout=aiohttp.ClientTimeout(total=4)) as resp,
        ):
            if resp.status == 200:
                data = await resp.json()
                tag = data.get("tag_name") or data.get("name")
                if tag:
                    tag_clean = str(tag).strip().lstrip("v")
                    _GITHUB_CACHE[repo] = {"version": tag_clean, "timestamp": now}
                    return tag_clean
            elif resp.status == 404:
                # Try tags endpoint if no formal release
                tags_url = f"https://api.github.com/repos/{repo}/tags"
                async with session.get(tags_url, headers=headers, timeout=aiohttp.ClientTimeout(total=4)) as tag_resp:
                    if tag_resp.status == 200:
                        tags_data = await tag_resp.json()
                        if tags_data and isinstance(tags_data, list):
                            tag_clean = str(tags_data[0].get("name", "")).strip().lstrip("v")
                            if tag_clean:
                                _GITHUB_CACHE[repo] = {"version": tag_clean, "timestamp": now}
                                return tag_clean
    except Exception as err:
        _LOGGER.debug("GitHub release check for %s failed: %s", repo, err)

    return cached.get("version") if cached else None


def compare_is_update_available(installed_ver: Optional[str], latest_ver: Optional[str]) -> bool:
    """Compare semver strings to determine if an update is available."""
    if not installed_ver or not latest_ver:
        return False
    try:
        inst_parts = [int(p) for p in installed_ver.lstrip("v").split("-")[0].split(".") if p.isdigit()]
        lat_parts = [int(p) for p in latest_ver.lstrip("v").split("-")[0].split(".") if p.isdigit()]
        return lat_parts > inst_parts
    except Exception:
        return installed_ver.lstrip("v") != latest_ver.lstrip("v")


class TokenState:
    def __init__(self) -> None:
        self.email: Optional[str] = None
        self.master_token: Optional[str] = None
        self.findmy_adm_token: Optional[str] = None
        self.findmy_shared_key: Optional[str] = None
        self.findmy_owner_key: Optional[str] = None
        self.status: str = "Ready for token input"
        self.last_error: Optional[str] = None
        self.requests_count: int = 0
        self.last_sync_time: Optional[float] = None
        self.request_counts_by_type: dict[str, int] = {"session": 0, "login": 0, "status": 0, "findmy": 0}
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
                    self.findmy_adm_token = data.get("findmy_adm_token")
                    self.findmy_shared_key = data.get("findmy_shared_key")
                    self.findmy_owner_key = data.get("findmy_owner_key")
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
                        "findmy_adm_token": self.findmy_adm_token,
                        "findmy_shared_key": self.findmy_shared_key,
                        "findmy_owner_key": self.findmy_owner_key,
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
        self.findmy_adm_token = None
        self.findmy_shared_key = None
        self.findmy_owner_key = None
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


async def auto_stop_inactivity_worker() -> None:
    """Monitor inactivity and trigger add-on shutdown after timeout."""
    _LOGGER.info("Starting auto-stop inactivity monitor...")
    while True:
        await asyncio.sleep(30)
        timeout_min = get_auto_stop_timeout_minutes()
        if timeout_min <= 0:
            continue

        timeout_sec = timeout_min * 60
        idle_duration = time.time() - _LAST_ACTIVITY_TIME
        if idle_duration >= timeout_sec:
            _LOGGER.warning(
                "Add-on inactive for %s minutes (threshold: %s min). Initiating graceful shutdown via Supervisor...",
                int(idle_duration // 60),
                timeout_min,
            )
            supervisor_token = os.getenv("SUPERVISOR_TOKEN")
            if supervisor_token:
                try:
                    async with (
                        aiohttp.ClientSession() as session,
                        session.post(
                            "http://supervisor/addons/self/stop",
                            headers={"Authorization": f"Bearer {supervisor_token}"},
                            timeout=aiohttp.ClientTimeout(total=5),
                        ) as resp,
                    ):
                        _LOGGER.info("Supervisor stop response: status %s", resp.status)
                except Exception as err:
                    _LOGGER.error("Failed to request Supervisor stop: %s", err)
            else:
                _LOGGER.info("Standalone mode: auto-stop threshold reached, stopping event loop.")
            break


@asynccontextmanager
async def lifespan(app: FastAPI):
    _LOGGER.info("Starting Google Home Token Hub...")
    asyncio.create_task(register_supervisor_discovery())
    asyncio.create_task(browser_service.start_chromium())
    asyncio.create_task(auto_stop_inactivity_worker())
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
        "service": "google_home",
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

    update_activity_timestamp()

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
            "findmy_adm_token": state.findmy_adm_token or "",
            "findmy_shared_key": state.findmy_shared_key or "",
            "findmy_owner_key": state.findmy_owner_key or "",
            "has_findmy_ready": bool(state.findmy_shared_key or state.findmy_adm_token),
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


def on_shared_key_acquired(email: str, shared_key_hex: str) -> None:
    state.email = email
    state.findmy_shared_key = shared_key_hex
    state.record_interaction("findmy", "Find My Shared Key captured")
    state.save()
    # Also auto-deploy secrets.json if integration path exists
    try:
        from .core.findmy_service import deploy_secrets_to_homeassistant

        bundle = {
            "googleHomeUsername": email,
            "aas_token": state.master_token,
            "shared_key": shared_key_hex,
        }
        if state.findmy_adm_token:
            bundle["adm_token"] = state.findmy_adm_token
        deploy_secrets_to_homeassistant(bundle)
    except Exception as err:
        _LOGGER.debug("Auto-deploying secrets failed: %s", err)


browser_service.set_on_success_callback(on_token_acquired)
browser_service.set_on_shared_key_callback(on_shared_key_acquired)


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
                state.last_error = "Google token exchange failed"
                state.record_interaction("login", f"Failed: {err_msg}")
                raise HTTPException(status_code=400, detail="Google rejected token exchange. Please verify your token.")
        except HTTPException:
            raise
        except Exception as err:
            _LOGGER.exception("Unexpected error exchanging token: %s", err)
            state.last_error = "Internal error during token exchange"
            state.record_interaction("login", "Internal token exchange exception")
            raise HTTPException(status_code=500, detail="An internal error occurred during token exchange.")

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
        _LOGGER.warning("Could not read Chromium stderr log: %s", err)
        return {"error": "Failed to read Chromium log file"}


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


# ── Google Find My Integration Endpoints ─────────────────────────────────────


class FindMySharedKeyRequest(BaseModel):
    shared_key: str


@app.get("/api/findmy/secrets")
@app.get("/api/v1/findmy/secrets")
async def get_findmy_secrets():
    """Return the generated secrets bundle formatted for GoogleFindMy-HA."""
    if not state.master_token and not state.findmy_adm_token:
        raise HTTPException(status_code=400, detail="No active Google session found. Please login first.")

    bundle: dict[str, Any] = {
        "googleHomeUsername": state.email or "",
        "aas_token": state.master_token or "",
    }
    if state.findmy_adm_token:
        bundle["adm_token"] = state.findmy_adm_token
    if state.findmy_shared_key:
        bundle["shared_key"] = state.findmy_shared_key
    if state.findmy_owner_key:
        bundle["owner_key"] = state.findmy_owner_key

    return {
        "email": state.email,
        "bundle": bundle,
        "bundle_json": json.dumps(bundle, indent=2),
        "has_shared_key": bool(state.findmy_shared_key),
        "has_adm_token": bool(state.findmy_adm_token),
    }


@app.post("/api/findmy/generate-adm-token")
@app.post("/api/v1/findmy/generate-adm-token")
async def post_generate_adm_token():
    """Mint an ADM (Android Device Manager) token using the existing Master Token."""
    if not state.master_token or not state.email:
        raise HTTPException(status_code=400, detail="Please connect your Google Account first to get a Master Token.")

    try:
        from .core.findmy_service import generate_adm_token
    except ImportError:
        from core.findmy_service import generate_adm_token

    res = generate_adm_token(state.email, state.master_token)
    if res.get("success") and res.get("token"):
        state.findmy_adm_token = res["token"]
        state.record_interaction("findmy", "Generated ADM Token")
        state.save()
        return {"success": True, "token": res["token"], "message": "Find My ADM Token generated successfully"}
    else:
        state.last_error = "Find My ADM Token generation failed"
        raise HTTPException(status_code=400, detail="Failed to generate ADM Token. Check credentials and try again.")


@app.post("/api/findmy/set-shared-key")
@app.post("/api/v1/findmy/set-shared-key")
async def post_set_shared_key(req: FindMySharedKeyRequest):
    """Manually or programmatically save the E2EE Shared Key."""
    key = req.shared_key.strip()
    if not key or len(key) < 16:
        raise HTTPException(status_code=400, detail="Invalid Shared Key length. Expected hex string.")

    state.findmy_shared_key = key
    state.record_interaction("findmy", "Manual Shared Key saved")
    state.save()

    return {"success": True, "shared_key": key}


@app.get("/api/findmy/security-url")
@app.get("/api/v1/findmy/security-url")
async def get_findmy_security_url():
    """Return the Google security domain unlock URL for E2EE keys."""
    try:
        from .core.findmy_service import get_security_domain_request_url
    except ImportError:
        from core.findmy_service import get_security_domain_request_url

    url = get_security_domain_request_url()
    return {"url": url}


@app.post("/api/findmy/extract-shared-key")
@app.post("/api/v1/findmy/extract-shared-key")
async def post_extract_shared_key():
    """Trigger headless Chromium to automatically extract the E2EE Shared Key.

    Requires an active authenticated browser session (master token must already exist).
    Navigates to the Google security domain unlock URL, injects the window.mm shim,
    and polls for the setVaultSharedKeys callback up to 30 seconds.
    """
    if not state.master_token or not state.email:
        raise HTTPException(
            status_code=400,
            detail="No active Google session. Please generate a Master Token first.",
        )

    # If already have a shared key, check if the user wants to refresh it
    # (we still proceed — let them call it again to refresh)

    # Run extraction in background and poll result
    extraction_task = asyncio.create_task(browser_service._attempt_shared_key_extraction(state.email))

    # Wait up to 32 seconds for the task to complete
    try:
        result = await asyncio.wait_for(asyncio.shield(extraction_task), timeout=32.0)
    except asyncio.TimeoutError:
        result = None

    if result:
        # Callback already saved to state; return success
        return {
            "success": True,
            "shared_key": result,
            "message": "E2EE Shared Key successfully extracted via headless browser.",
        }

    # Check if the callback fired while we were waiting (race condition safeguard)
    if state.findmy_shared_key:
        return {
            "success": True,
            "shared_key": state.findmy_shared_key,
            "message": "E2EE Shared Key captured via browser session.",
        }

    raise HTTPException(
        status_code=408,
        detail=(
            "Could not automatically extract the E2EE Shared Key. "
            "This usually means the headless browser session has expired or "
            "Google requires a fresh screen-lock confirmation. "
            "Try using the manual Google Unlock flow below."
        ),
    )


@app.post("/api/findmy/deploy")
@app.post("/api/v1/findmy/deploy")
async def post_findmy_deploy():
    """Automatically deploy secrets.json into /config/custom_components/googlefindmy/Auth/secrets.json."""
    if not state.email or not state.master_token:
        raise HTTPException(status_code=400, detail="No active Google credentials to deploy.")

    try:
        from .core.findmy_service import deploy_secrets_to_homeassistant
    except ImportError:
        from core.findmy_service import deploy_secrets_to_homeassistant

    bundle: dict[str, Any] = {
        "googleHomeUsername": state.email,
        "aas_token": state.master_token,
    }
    if state.findmy_adm_token:
        bundle["adm_token"] = state.findmy_adm_token
    if state.findmy_shared_key:
        bundle["shared_key"] = state.findmy_shared_key
    if state.findmy_owner_key:
        bundle["owner_key"] = state.findmy_owner_key

    success, path_or_msg = deploy_secrets_to_homeassistant(bundle)
    if success:
        state.record_interaction("findmy", "Secrets deployed to HA")
        return {"success": True, "path": path_or_msg, "message": f"Successfully written to {path_or_msg}"}
    else:
        return {"success": False, "message": path_or_msg}


class InstallIntegrationRequest(BaseModel):
    integration: str


@app.get("/api/integrations/status")
@app.get("/api/v1/integrations/status")
async def get_integrations_status():
    """Return status, versions, update checks, and restart states for supported integrations."""
    update_activity_timestamp()
    restart_state = get_pending_restart_state()
    integrations_list = []

    for slug, spec in INTEGRATION_SPECS.items():
        manifest = get_installed_integration_manifest(slug)
        is_installed = manifest is not None
        installed_version = manifest.get("version") if manifest else None
        latest_version = await fetch_latest_github_release(spec["repo"])
        update_available = compare_is_update_available(installed_version, latest_version) if is_installed else False
        is_pending_restart = slug in restart_state.get("pending_integrations", [])

        integrations_list.append(
            {
                "slug": slug,
                "name": spec["name"],
                "title": spec["title"],
                "category": spec["category"],
                "repo": spec["repo"],
                "is_installed": is_installed,
                "installed_version": installed_version,
                "latest_version": latest_version,
                "update_available": update_available,
                "is_pending_restart": is_pending_restart,
                "hacs_url": spec["hacs_url"],
                "github_url": spec["github_url"],
            }
        )

    return {
        "integrations": integrations_list,
        "restart_required": restart_state.get("restart_required", False),
        "pending_integrations": restart_state.get("pending_integrations", []),
        "auto_stop_timeout": get_auto_stop_timeout_minutes(),
    }


@app.post("/api/integrations/install")
@app.post("/api/v1/integrations/install")
async def post_install_integration(req: InstallIntegrationRequest):
    """Download and install/update an integration directly into /config/custom_components/."""
    update_activity_timestamp()
    slug = req.integration.strip()
    if slug not in INTEGRATION_SPECS:
        raise HTTPException(status_code=400, detail=f"Unknown integration slug '{slug}'")

    spec = INTEGRATION_SPECS[slug]
    ha_cfg = os.getenv("HA_CONFIG_ROOT", "/config")
    target_components_dir = os.path.join(ha_cfg, "custom_components")
    target_dir = os.path.join(target_components_dir, spec["folder"])

    repo = spec["repo"]
    zip_url = f"https://github.com/{repo}/archive/refs/heads/master.zip"
    # Or fetch release zip if latest release exists
    latest_ver = await fetch_latest_github_release(repo)
    if latest_ver:
        zip_url = f"https://github.com/{repo}/archive/refs/tags/v{latest_ver}.zip"

    headers = {
        "User-Agent": "HomeAssistant-GoogleHome-Addon",
        "Accept": "*/*",
    }
    gh_token = os.getenv("GITHUB_TOKEN") or get_addon_options().get("github_token")
    if gh_token:
        headers["Authorization"] = f"Bearer {gh_token}"

    import io
    import zipfile

    _LOGGER.info("Starting 1-click installation of %s from %s...", spec["name"], zip_url)
    zip_bytes = None
    try:
        async with aiohttp.ClientSession() as session:
            # Try specific release zip, fall back to master branch zip
            for candidate_url in [
                zip_url,
                f"https://github.com/{repo}/archive/refs/heads/master.zip",
                f"https://github.com/{repo}/archive/refs/heads/main.zip",
            ]:
                try:
                    async with session.get(
                        candidate_url, headers=headers, timeout=aiohttp.ClientTimeout(total=20)
                    ) as resp:
                        if resp.status == 200:
                            zip_bytes = await resp.read()
                            break
                except Exception as dl_err:
                    _LOGGER.debug("Download retry from %s: %s", candidate_url, dl_err)

        if not zip_bytes:
            raise HTTPException(status_code=502, detail=f"Failed to download repository archive for {spec['name']}.")

        zf = zipfile.ZipFile(io.BytesIO(zip_bytes))
        prefix_folder = f"custom_components/{spec['folder']}/"
        # Find where the component folder is inside the zip archive
        matching_members = [m for m in zf.namelist() if f"/{prefix_folder}" in m or m.startswith(prefix_folder)]

        if not matching_members:
            # Maybe the repo root is the component (fallback check)
            matching_members = [m for m in zf.namelist() if "manifest.json" in m]
            if not matching_members:
                raise HTTPException(status_code=500, detail="Could not locate custom_components folder in archive.")

        # Determine root common prefix for the component
        manifest_member = next(
            (m for m in zf.namelist() if m.endswith(f"{spec['folder']}/manifest.json") or m.endswith("/manifest.json")),
            None,
        )
        if not manifest_member:
            raise HTTPException(status_code=500, detail="Could not find manifest.json inside download.")

        component_base_prefix = os.path.dirname(manifest_member)

        os.makedirs(target_dir, exist_ok=True)
        for member in zf.namelist():
            if member.startswith(component_base_prefix + "/") and not member.endswith("/"):
                rel_path = member[len(component_base_prefix) + 1 :]
                dest_path = os.path.join(target_dir, rel_path)
                os.makedirs(os.path.dirname(dest_path), exist_ok=True)
                with open(dest_path, "wb") as f_out:
                    f_out.write(zf.read(member))

        set_pending_restart_state(slug)
        state.record_interaction("install", f"Installed/Updated {spec['name']}")
        _LOGGER.info("Successfully installed %s into %s", spec["name"], target_dir)

        # Clear cached version to reflect update
        _GITHUB_CACHE.pop(repo, None)

        return {
            "success": True,
            "integration": slug,
            "name": spec["name"],
            "installed_path": target_dir,
            "restart_required": True,
            "message": f"Successfully installed {spec['name']}. Home Assistant restart required!",
        }

    except Exception as err:
        _LOGGER.exception("Error installing integration %s: %s", slug, err)
        raise HTTPException(
            status_code=500, detail="Integration installation failed. Check add-on logs for details."
        ) from err
