import asyncio
import contextlib
import json
import logging
import os
import re
import socket
import time
from contextlib import asynccontextmanager
from typing import Any, Optional

import aiohttp
from browser import browser_service
from fastapi import FastAPI, HTTPException, Request, Security
from fastapi.responses import HTMLResponse
from fastapi.security.api_key import APIKeyHeader
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from pydantic import BaseModel

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
_LOGGER = logging.getLogger("traderepublic-addon")


class EndpointFilter(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        msg = record.getMessage()
        return "/api/v1/status" not in msg and "/api/v1/login/qr" not in msg


logging.getLogger("uvicorn.access").addFilter(EndpointFilter())

_SUPERVISOR_TOKEN = os.getenv("SUPERVISOR_TOKEN", "")
_api_key_header = APIKeyHeader(name="Authorization", auto_error=False)

_CACHED_ADDON_VERSION: Optional[str] = None
_CACHED_ADDON_HOSTNAME: Optional[str] = None
_INTEGRATION_VERSION_CACHE: tuple[float, str] = (0.0, "—")


async def require_supervisor_auth(
    request: Request,
    authorization: Optional[str] = Security(_api_key_header),
) -> None:
    """Require valid auth: allow Home Assistant container subnet (172.30.32.0/23, 127.0.0.1) or valid Bearer token."""
    client_ip = request.client.host if request.client else ""

    if (
        client_ip in ("127.0.0.1", "::1", "localhost")
        or client_ip.startswith("172.30.")
        or client_ip.startswith("172.17.")
    ):
        return

    if _SUPERVISOR_TOKEN:
        expected = f"Bearer {_SUPERVISOR_TOKEN}"
        if authorization and authorization == expected:
            return

    if request.headers.get("X-Ingress-Path") or request.headers.get("x-ingress-path"):
        return

    raise HTTPException(status_code=403, detail="Forbidden: internal network or valid authorization required")


async def _fetch_supervisor_self_info() -> dict[str, Any]:
    """Fetch add-on metadata asynchronously from Supervisor without blocking the event loop."""
    supervisor_token = os.getenv("SUPERVISOR_TOKEN")
    if not supervisor_token:
        return {}
    try:
        async with (
            aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=3)) as session,
            session.get(
                "http://supervisor/addons/self/info",
                headers={"Authorization": f"Bearer {supervisor_token}"},
            ) as resp,
        ):
            if resp.status == 200:
                payload = await resp.json()
                return payload.get("data") or {}
    except Exception as exc:  # noqa: BLE001
        _LOGGER.debug("Could not fetch Supervisor self info: %s", exc)
    return {}


async def _refresh_supervisor_cache() -> None:
    """Populate cached add-on version and hostname from Supervisor."""
    global _CACHED_ADDON_VERSION, _CACHED_ADDON_HOSTNAME
    info = await _fetch_supervisor_self_info()
    ver = info.get("version")
    if ver and str(ver).strip() not in ("unknown", "0.1.0", ""):
        _CACHED_ADDON_VERSION = str(ver).strip()
    hostname = info.get("hostname")
    if hostname and str(hostname).strip():
        _CACHED_ADDON_HOSTNAME = str(hostname).strip()


@asynccontextmanager
async def lifespan(app: FastAPI):
    _LOGGER.info("Starting Trade Republic Browser Engine...")
    await _refresh_supervisor_cache()
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

    if not _CACHED_ADDON_HOSTNAME:
        await _refresh_supervisor_cache()

    host_name = _CACHED_ADDON_HOSTNAME or socket.gethostname() or "edfe50eb-traderepublic"
    port = int(os.getenv("PORT", "8095"))
    headers = {
        "Authorization": f"Bearer {supervisor_token}",
        "Content-Type": "application/json",
    }
    payload = {
        "service": "traderepublic",
        "config": {
            "host": host_name,
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
                    _LOGGER.info(
                        "Successfully registered Trade Republic discovery with Supervisor (host=%s)", host_name
                    )
                    break
                resp_txt = await resp.text()
                _LOGGER.debug("Supervisor discovery response (attempt %s) [%s]: %s", attempt + 1, resp.status, resp_txt)
        except Exception as exc:
            _LOGGER.debug("Could not notify Supervisor discovery (attempt %s): %s", attempt + 1, exc)


app = FastAPI(title="Trade Republic Headless Browser Session Provider", lifespan=lifespan)


@app.middleware("http")
async def ingress_middleware(request: Request, call_next):
    """Handle Home Assistant Ingress dynamic subpath prefix and normalize slashes."""
    path = request.scope.get("path", "/")
    path = re.sub(r"/+", "/", path)

    ingress_path = request.headers.get("x-ingress-path")
    if ingress_path:
        clean_prefix = re.sub(r"/+", "/", ingress_path).rstrip("/")
        if clean_prefix and path.startswith(clean_prefix):
            path = path[len(clean_prefix) :] or "/"
            path = re.sub(r"/+", "/", path)

    request.scope["path"] = path or "/"
    return await call_next(request)


templates = Jinja2Templates(directory="templates" if os.path.exists("templates") else "/opt/traderepublic/templates")
static_dir = "static" if os.path.exists("static") else "/opt/traderepublic/static"
if os.path.exists(static_dir):
    app.mount("/static", StaticFiles(directory=static_dir), name="static")


def get_addon_version() -> str:
    """Retrieve the cached Trade Republic add-on version without blocking I/O."""
    if _CACHED_ADDON_VERSION:
        return _CACHED_ADDON_VERSION

    for env_key in ("ADDON_VERSION", "APP_VERSION"):
        env_val = os.getenv(env_key)
        if env_val and env_val.strip() not in ("unknown", "0.1.0", "1.0.0", ""):
            return env_val.strip()

    for path in [
        "/opt/traderepublic/config.yaml",
        "config.yaml",
        "/config.yaml",
        os.path.join(os.path.dirname(__file__), "..", "config.yaml"),
    ]:
        if os.path.exists(path):
            with contextlib.suppress(Exception):
                with open(path, "r", encoding="utf-8") as f:
                    for line in f:
                        if line.startswith("version:"):
                            parsed = line.split(":", 1)[1].strip().strip('"').strip("'")
                            if parsed and parsed != "1.0.0":
                                return parsed

    fallback = os.getenv("APP_VERSION") or os.getenv("ADDON_VERSION")
    return fallback.strip() if fallback else "dev"


def get_integration_version() -> str:
    """Retrieve locally installed Trade Republic custom integration version (60s TTL cache)."""
    global _INTEGRATION_VERSION_CACHE
    now = time.monotonic()
    cached_ts, cached_ver = _INTEGRATION_VERSION_CACHE
    if cached_ts > 0 and (now - cached_ts) < 60.0:
        return cached_ver

    ha_cfg = os.getenv("HA_CONFIG_ROOT", "/config")
    candidates = [
        os.path.join(ha_cfg, "custom_components", "traderepublic", "manifest.json"),
        "/config/custom_components/traderepublic/manifest.json",
        "/homeassistant/custom_components/traderepublic/manifest.json",
        "custom_components/traderepublic/manifest.json",
        "../ha-traderepublic/custom_components/traderepublic/manifest.json",
        os.path.join(
            os.path.dirname(__file__),
            "..",
            "..",
            "ha-traderepublic",
            "custom_components",
            "traderepublic",
            "manifest.json",
        ),
    ]
    resolved = "—"
    for path in candidates:
        if os.path.exists(path):
            with contextlib.suppress(Exception):
                with open(path, "r", encoding="utf-8") as f:
                    manifest = json.load(f)
                    ver = manifest.get("version")
                    if ver:
                        resolved = str(ver).strip()
                        break

    _INTEGRATION_VERSION_CACHE = (now, resolved)
    return resolved


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
    now = time.time()
    last_sync_sec = int(now - browser_service.last_sync_time) if browser_service.last_sync_time else None

    last_data_time = getattr(browser_service._ws_keeper, "last_data_update_time", None)
    last_data_sec: Optional[int] = int(now - last_data_time) if last_data_time else None
    last_login_sec: Optional[int] = (
        int(now - browser_service.last_login_time) if browser_service.last_login_time else None
    )
    last_token_sec: Optional[int] = (
        int(now - browser_service.last_token_update_time) if browser_service.last_token_update_time else None
    )
    last_checked_sec: Optional[int] = (
        int(now - browser_service.token_verified_at) if browser_service.token_verified_at else None
    )
    last_logout_sec: Optional[int] = (
        int(now - browser_service.last_logout_time) if browser_service.last_logout_time else None
    )

    all_i18n: dict[str, Any] = {}
    i18n_dir = os.path.join(static_dir, "i18n")
    if os.path.exists(i18n_dir):
        for lang_file in os.listdir(i18n_dir):
            if lang_file.endswith(".json"):
                lang_code = lang_file[:-5]
                with contextlib.suppress(Exception):
                    with open(os.path.join(i18n_dir, lang_file), "r", encoding="utf-8") as f:
                        all_i18n[lang_code] = json.load(f)

    login_in_progress = False
    login_remaining_sec = 0
    if browser_service.login_started_at and not browser_service.is_logged_in:
        elapsed = now - browser_service.login_started_at
        if elapsed < 120:
            login_in_progress = True
            login_remaining_sec = int(120 - elapsed)

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
            "last_data_sec": last_data_sec,
            "last_login_sec": last_login_sec,
            "last_token_sec": last_token_sec,
            "last_checked_sec": last_checked_sec,
            "last_logout_sec": last_logout_sec,
            "last_logout_reason": browser_service.last_logout_reason,
            "last_session_duration": browser_service.last_session_duration,
            "login_in_progress": login_in_progress,
            "login_remaining_sec": login_remaining_sec,
            "last_interaction_type": browser_service.last_interaction_type,
            "last_interaction_details": browser_service.last_interaction_details,
            "request_counts_by_type": browser_service.request_counts_by_type,
            "addon_version": get_addon_version(),
            "integration_version": get_integration_version(),
            "all_i18n": json.dumps(all_i18n),
        },
    )


@app.get("/api/v1/status")
async def get_status():
    login_in_progress = False
    login_remaining_sec = 0
    if browser_service.login_started_at and not browser_service.is_logged_in:
        elapsed = time.time() - browser_service.login_started_at
        if elapsed < 120:
            login_in_progress = True
            login_remaining_sec = int(120 - elapsed)

    return {
        "status": "online",
        "service": "traderepublic-addon",
        "is_logged_in": browser_service.is_logged_in,
        "has_session": bool(browser_service.session_token),
        "ws_authenticated": browser_service._ws_keeper.is_authenticated,
        "ws_connecting": browser_service._ws_keeper.is_connecting,
        "active_categories": sorted(browser_service._ws_keeper.active_categories),
        "phone_number": browser_service.phone_number,
        "message": browser_service.status_message,
        "last_error": browser_service.last_error,
        "login_in_progress": login_in_progress,
        "login_remaining_sec": login_remaining_sec,
        "requests_count": browser_service.client_requests_count,
        "last_sync_time": browser_service.last_sync_time,
        "last_checked_time": browser_service.token_verified_at,
        "last_data_update_time": getattr(browser_service._ws_keeper, "last_data_update_time", None),
        "last_login_time": browser_service.last_login_time,
        "last_token_update_time": browser_service.last_token_update_time,
        "last_logout_time": browser_service.last_logout_time,
        "last_logout_reason": browser_service.last_logout_reason,
        "last_session_duration": browser_service.last_session_duration,
        "last_interaction_type": browser_service.last_interaction_type,
        "last_interaction_details": browser_service.last_interaction_details,
        "request_counts_by_type": browser_service.request_counts_by_type,
        "addon_version": get_addon_version(),
        "integration_version": get_integration_version(),
    }


@app.get("/api/v1/session", dependencies=[Security(require_supervisor_auth)])
async def get_session():
    browser_service.client_requests_count += 1
    browser_service.last_sync_time = time.time()
    browser_service.last_interaction_type = "Session Token Sync"
    browser_service.last_interaction_details = "Home Assistant synchronized session token"
    browser_service.request_counts_by_type["session"] += 1
    if not browser_service.session_token:
        return {
            "session_token": None,
            "phone_number": browser_service.phone_number,
            "is_logged_in": False,
            "is_connecting": False,
            "token_verified": False,
            "token_verified_at": None,
        }
    is_connecting = browser_service._ws_keeper.is_connecting
    token_confirmed = browser_service._ws_keeper.is_authenticated or (browser_service.is_logged_in and is_connecting)
    return {
        "session_token": browser_service.session_token,
        "phone_number": browser_service.phone_number,
        "is_logged_in": token_confirmed,
        "is_connecting": is_connecting,
        "token_verified": browser_service._ws_keeper.is_authenticated,
        "token_verified_at": browser_service.token_verified_at,
    }


@app.get("/api/v1/data", dependencies=[Security(require_supervisor_auth)])
async def get_data(categories: Optional[str] = None):
    """Return live portfolio data and metrics collected by the persistent keeper."""
    browser_service.client_requests_count += 1
    browser_service.last_sync_time = time.time()
    browser_service.last_interaction_type = "Live Data Fetch"
    cat_str = categories or "all"
    browser_service.last_interaction_details = f"Live metrics query (categories: {cat_str})"
    browser_service.request_counts_by_type["data"] += 1

    if categories and hasattr(browser_service, "_ws_keeper"):
        requested_set = {c.strip().lower() for c in categories.split(",") if c.strip()}
        await browser_service._ws_keeper.sync_categories(requested_set)

    data = getattr(browser_service._ws_keeper, "latest_data", {})
    last_update = getattr(browser_service._ws_keeper, "last_data_update_time", None)
    now = time.time()

    is_connecting = browser_service._ws_keeper.is_connecting
    is_active = browser_service.is_logged_in and browser_service._ws_keeper.is_authenticated
    is_stale = False
    grace_remaining = 0
    auth_expired = bool(
        not is_active
        and not is_connecting
        and (
            not browser_service.session_token
            or browser_service._is_logged_in_override is False
            or (browser_service._ws_keeper.last_error and "401" in browser_service._ws_keeper.last_error)
        )
    )

    try:
        retention_hours = float(os.environ.get("CACHE_RETENTION_HOURS", "12"))
    except ValueError:
        retention_hours = 12.0

    retention_seconds = max(0.0, retention_hours * 3600.0)

    if not is_active:
        if last_update and (now - last_update <= retention_seconds):
            is_stale = True
            grace_remaining = int(retention_seconds - (now - last_update))
        else:
            data = {}

    return {
        "is_logged_in": is_active or is_stale or is_connecting,
        "is_authenticated": is_active,
        "is_connecting": is_connecting,
        "auth_expired": auth_expired,
        "is_stale": is_stale,
        "grace_remaining_seconds": grace_remaining,
        "phone_number": browser_service.phone_number,
        "data": data,
        "timestamp": now,
    }


@app.get("/api/v1/timeline", dependencies=[Security(require_supervisor_auth)])
async def get_timeline(limit: int = 50, search: Optional[str] = None):
    """Query transactions from the timeline history with optional limit and search filtering."""
    data = getattr(browser_service._ws_keeper, "latest_data", {})
    all_txs = data.get("all_transactions") or data.get("recent_transactions") or []

    if search:
        search_lower = search.strip().lower()
        all_txs = [
            tx
            for tx in all_txs
            if search_lower in str(tx.get("title", "")).lower() or search_lower in str(tx.get("subtitle", "")).lower()
        ]

    effective_limit = max(1, min(limit, 500))
    return {
        "transactions": all_txs[:effective_limit],
        "total_count": len(all_txs),
        "count": min(len(all_txs), effective_limit),
    }


@app.post("/api/v1/session/manual", dependencies=[Security(require_supervisor_auth)])
async def set_manual_session(req: ManualTokenRequest):
    await browser_service.save_session(req.session_token, req.phone_number)
    return {"success": True, "message": "Session token saved successfully"}


@app.get("/api/v1/login/qr")
@app.post("/api/v1/login/qr")
async def get_login_qr(refresh: bool = False):
    """Retrieve the current QR code from Trade Republic login page."""
    return await browser_service.get_qr_code(force_refresh=refresh)


@app.post("/api/v1/login/init")
async def post_login_init(req: LoginInitRequest):
    return await browser_service.start_login(req.phone_number, req.pin)


@app.post("/api/v1/login/verify")
async def post_login_verify(req: VerifyRequest):
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
