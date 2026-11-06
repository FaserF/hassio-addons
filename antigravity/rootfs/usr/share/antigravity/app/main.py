"""Main FastAPI application for Google Antigravity Home Assistant Addon."""

from __future__ import annotations

import json
import logging
import os
from contextlib import asynccontextmanager
from pathlib import Path
from typing import List

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from .models import AccountConfig
from .router import api_router
from .scheduler import DynamicScheduler

_LOGGER = logging.getLogger("antigravity")

# Paths
OPTIONS_FILE = os.getenv("ANTIGRAVITY_OPTIONS_PATH", "/data/options.json")
DATA_DIR = Path(os.getenv("ANTIGRAVITY_DATA_DIR", "/data/antigravity"))
ACCOUNTS_STORE_FILE = DATA_DIR / "accounts.json"
UI_DIR = Path(__file__).resolve().parent.parent / "ui"


def load_configuration() -> dict:
    """Load configuration from options.json or persistent storage."""
    cfg = {
        "log_level": os.getenv("ANTIGRAVITY_LOG_LEVEL", "info"),
        "scan_interval": int(os.getenv("ANTIGRAVITY_SCAN_INTERVAL", "1800")),
        "adaptive_polling": os.getenv("ANTIGRAVITY_ADAPTIVE_POLLING", "true").lower() in ("true", "1", "yes"),
        "fast_poll_interval": int(os.getenv("ANTIGRAVITY_FAST_POLL_INTERVAL", "180")),
        "idle_backoff_interval": int(os.getenv("ANTIGRAVITY_IDLE_BACKOFF_INTERVAL", "3600")),
        "accounts": [],
    }

    # 1. Read base options from options.json
    if os.path.exists(OPTIONS_FILE):
        try:
            with open(OPTIONS_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
                if isinstance(data, dict):
                    cfg["log_level"] = data.get("log_level", cfg["log_level"])
                    cfg["scan_interval"] = int(data.get("scan_interval", cfg["scan_interval"]))
                    cfg["adaptive_polling"] = bool(data.get("adaptive_polling", cfg["adaptive_polling"]))
                    cfg["fast_poll_interval"] = int(data.get("fast_poll_interval", cfg["fast_poll_interval"]))
                    cfg["idle_backoff_interval"] = int(data.get("idle_backoff_interval", cfg["idle_backoff_interval"]))
                    cfg["accounts"] = data.get("accounts", [])
        except Exception as ex:
            _LOGGER.warning("Could not read options.json: %s", ex)

    # 2. Check persistent accounts store (created via UI)
    if ACCOUNTS_STORE_FILE.exists():
        try:
            with open(ACCOUNTS_STORE_FILE, "r", encoding="utf-8") as f:
                saved_accounts = json.load(f)
                if isinstance(saved_accounts, list) and len(saved_accounts) > 0:
                    cfg["accounts"] = saved_accounts
        except Exception as ex:
            _LOGGER.warning("Could not read accounts store: %s", ex)

    return cfg


def parse_accounts(raw_accounts: list) -> List[AccountConfig]:
    """Parse list of account dictionaries into AccountConfig objects."""
    accounts: List[AccountConfig] = []
    for item in raw_accounts:
        if isinstance(item, dict):
            name = item.get("name", "Account")
            token = item.get("refresh_token", "")
            cid = item.get("client_id", "")
            csec = item.get("client_secret", "")
            pid = item.get("project_id", "")
            # Only add if has name or token
            if name or token:
                accounts.append(
                    AccountConfig(
                        name=name,
                        refresh_token=token,
                        client_id=cid,
                        client_secret=csec,
                        project_id=pid,
                    )
                )
    return accounts


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan context manager for startup and shutdown."""
    cfg = load_configuration()

    # Configure logging
    log_level = getattr(logging, cfg["log_level"].upper(), logging.INFO)
    logging.basicConfig(
        level=log_level,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    )
    _LOGGER.setLevel(log_level)

    accounts = parse_accounts(cfg["accounts"])

    scheduler = DynamicScheduler(
        accounts=accounts,
        base_interval=cfg["scan_interval"],
        adaptive_polling=cfg["adaptive_polling"],
        fast_interval=cfg["fast_poll_interval"],
        idle_interval=cfg["idle_backoff_interval"],
        version="0.1.0",
    )
    app.state.scheduler = scheduler

    # Start background polling
    await scheduler.start()
    _LOGGER.info("Google Antigravity Addon service initialized.")

    yield

    # Shutdown
    await scheduler.stop()
    _LOGGER.info("Google Antigravity Addon service shut down cleanly.")


app = FastAPI(
    title="Google Antigravity Addon",
    version="0.1.0",
    description="Google Antigravity Quota Monitor and Ingress Dashboard",
    lifespan=lifespan,
)

# CORS middleware for Ingress and development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API Router
app.include_router(api_router)


@app.get("/healthz")
async def healthz():
    """Root healthcheck probe for Docker / Kubernetes / S6."""
    return {"status": "ok", "app": "antigravity"}


# Mount UI static files if directory exists
if UI_DIR.exists():
    app.mount("/static", StaticFiles(directory=str(UI_DIR)), name="static")

    @app.get("/")
    async def serve_index():
        """Serve SPA index.html."""
        index_file = UI_DIR / "index.html"
        if index_file.exists():
            return FileResponse(str(index_file))
        return {"message": "Antigravity UI files not found."}
