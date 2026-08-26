import asyncio
import json
import logging
import os
from contextlib import asynccontextmanager
from typing import Optional

import aiohttp
from fastapi import FastAPI, HTTPException, Request, Security
from fastapi.responses import HTMLResponse
from fastapi.security.api_key import APIKeyHeader
from fastapi.templating import Jinja2Templates
from pydantic import BaseModel

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
_LOGGER = logging.getLogger("googlehome-addon")

_SUPERVISOR_TOKEN = os.getenv("SUPERVISOR_TOKEN", "")
_api_key_header = APIKeyHeader(name="Authorization", auto_error=False)

DATA_DIR = os.getenv("DATA_DIR", "/data")
SESSION_FILE = os.path.join(DATA_DIR, "session.json")


class TokenState:
    def __init__(self) -> None:
        self.email: Optional[str] = None
        self.master_token: Optional[str] = None
        self.status: str = "Bereit für Token-Eingabe"
        self.last_error: Optional[str] = None
        self.load()

    def load(self) -> None:
        if os.path.exists(SESSION_FILE):
            try:
                with open(SESSION_FILE, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    self.email = data.get("email")
                    self.master_token = data.get("master_token")
                    if self.master_token:
                        self.status = "Master Token aktiv und verknüpft"
            except Exception as err:
                _LOGGER.warning("Konnte session.json nicht laden: %s", err)

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
            _LOGGER.error("Fehler beim Speichern der Session: %s", err)


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
templates = Jinja2Templates(directory=os.path.join(os.path.dirname(__file__), "templates"))


class LoginRequest(BaseModel):
    email: str
    password: Optional[str] = None
    token: Optional[str] = None


@app.get("/", response_class=HTMLResponse)
async def get_index(request: Request):
    root_path = request.headers.get("X-Ingress-Path", "").rstrip("/")
    return templates.TemplateResponse(
        "index.html",
        {
            "request": request,
            "root_path": root_path,
            "email": state.email or "",
            "master_token": state.master_token or "",
            "is_logged_in": bool(state.master_token),
            "status": state.status,
            "last_error": state.last_error,
        },
    )


@app.post("/api/login", dependencies=[Security(require_auth)])
async def post_login(req: LoginRequest):
    email = req.email.strip()
    raw_token = (req.token or "").strip()
    password = (req.password or "").strip()

    if not email:
        raise HTTPException(status_code=400, detail="Email ist erforderlich")

    if raw_token.startswith("aas_et/"):
        state.email = email
        state.master_token = raw_token
        state.status = "Master Token aktiv und verknüpft"
        state.last_error = None
        state.save()
        return {"success": True, "master_token": raw_token}

    if raw_token:
        if raw_token.startswith("oauth_token="):
            raw_token = raw_token.split("oauth_token=")[1].split(";")[0].strip()
        try:
            from gpsoauth import exchange_token

            res = exchange_token(email, raw_token, "android-701ab861a7be")
            if "Token" in res:
                master_token = res["Token"]
                state.email = email
                state.master_token = master_token
                state.status = "Token erfolgreich eingetauscht & verknüpft"
                state.last_error = None
                state.save()
                return {"success": True, "master_token": master_token}
            else:
                err_msg = res.get("Error", "Unbekannt")
                state.last_error = f"Google Token Fehler: {err_msg}"
                raise HTTPException(status_code=400, detail=state.last_error)
        except HTTPException:
            raise
        except Exception as err:
            state.last_error = str(err)
            raise HTTPException(status_code=500, detail=f"Fehler: {err}")

    if password:
        try:
            from gpsoauth import perform_master_login

            res = perform_master_login(email, password, "android-701ab861a7be")
            if "Token" in res:
                master_token = res["Token"]
                state.email = email
                state.master_token = master_token
                state.status = "App-Passwort erfolgreich verknüpft"
                state.last_error = None
                state.save()
                return {"success": True, "master_token": master_token}
            else:
                err_msg = res.get("Error", "BadAuthentication")
                state.last_error = f"Google Login Fehler: {err_msg}"
                raise HTTPException(status_code=400, detail=state.last_error)
        except HTTPException:
            raise
        except Exception as err:
            state.last_error = str(err)
            raise HTTPException(status_code=500, detail=f"Fehler: {err}")

    raise HTTPException(status_code=400, detail="Entweder Token oder App-Passwort angeben")


@app.get("/api/v1/session", dependencies=[Security(require_auth)])
async def get_session():
    return {
        "email": state.email,
        "master_token": state.master_token,
        "is_logged_in": bool(state.master_token),
        "status": state.status,
        "last_error": state.last_error,
    }
