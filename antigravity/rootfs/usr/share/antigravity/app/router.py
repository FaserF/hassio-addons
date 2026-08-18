"""REST API router for Google Antigravity."""

from __future__ import annotations

import logging
from typing import Any, Dict, List

from fastapi import APIRouter, HTTPException, Request

from .models import (
    AccountQuota,
    CredentialsTestRequest,
    RefreshRequest,
    SystemStatus,
)

_LOGGER = logging.getLogger(__name__)

api_router = APIRouter(prefix="/api", tags=["antigravity"])


@api_router.get("/status", response_model=SystemStatus)
async def get_status(request: Request) -> SystemStatus:
    """Get complete addon status, multi-account quotas, and scheduler telemetry."""
    scheduler = request.app.state.scheduler
    return scheduler.get_system_status()


@api_router.get("/accounts", response_model=List[AccountQuota])
async def get_accounts(request: Request) -> List[AccountQuota]:
    """List all accounts and current quotas."""
    scheduler = request.app.state.scheduler
    status = scheduler.get_system_status()
    return status.accounts


@api_router.get("/accounts/{account_name}/quota", response_model=AccountQuota)
async def get_account_quota(account_name: str, request: Request) -> AccountQuota:
    """Get detailed quota metrics for a single account."""
    scheduler = request.app.state.scheduler
    quota = scheduler.get_account_quota(account_name)
    if not quota:
        raise HTTPException(status_code=404, detail=f"Account '{account_name}' not found.")
    return quota


@api_router.post("/refresh", response_model=SystemStatus)
async def trigger_refresh(req: RefreshRequest, request: Request) -> SystemStatus:
    """Trigger an immediate force refresh of all accounts (or a specified account)."""
    scheduler = request.app.state.scheduler
    return await scheduler.force_refresh(req.account_name)


@api_router.post("/accounts/{account_name}/refresh", response_model=AccountQuota)
async def refresh_single_account(account_name: str, request: Request) -> AccountQuota:
    """Trigger an immediate force refresh of a specific account."""
    scheduler = request.app.state.scheduler
    await scheduler.force_refresh(account_name)
    quota = scheduler.get_account_quota(account_name)
    if not quota:
        raise HTTPException(status_code=404, detail=f"Account '{account_name}' not found.")
    return quota


@api_router.post("/test-credentials", response_model=Dict[str, Any])
async def test_credentials(req: CredentialsTestRequest, request: Request) -> Dict[str, Any]:
    """Validate pasted OAuth credentials or refresh token."""
    fetcher = request.app.state.scheduler.fetcher
    return await fetcher.test_credentials(req)


@api_router.get("/config", response_model=Dict[str, Any])
async def get_config(request: Request) -> Dict[str, Any]:
    """Get non-sensitive addon runtime configuration."""
    scheduler = request.app.state.scheduler
    return {
        "version": scheduler.version,
        "base_interval": scheduler.base_interval,
        "fast_interval": scheduler.fast_interval,
        "idle_interval": scheduler.idle_interval,
        "adaptive_polling": scheduler.adaptive_polling,
        "accounts_count": len(scheduler.accounts),
        "accounts": [
            {"name": a.name, "has_token": bool(a.refresh_token.strip()), "project_id": a.project_id}
            for a in scheduler.accounts
        ],
    }


@api_router.get("/health")
async def health_check() -> Dict[str, str]:
    """API health status."""
    return {"status": "ok", "service": "antigravity"}
