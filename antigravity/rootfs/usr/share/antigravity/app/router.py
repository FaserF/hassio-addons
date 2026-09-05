"""REST API router for Google Antigravity."""

from __future__ import annotations

import logging
from typing import Any, Dict, List

from fastapi import APIRouter, HTTPException, Request

from .fetcher import parse_credentials_input
from .models import (
    AccountActionResponse,
    AccountConfig,
    AccountCreateRequest,
    AccountQuota,
    AuthCodeExchangeRequest,
    CredentialsTestRequest,
    DeviceAuthPollRequest,
    DeviceAuthPollResponse,
    DeviceAuthStartRequest,
    DeviceAuthStartResponse,
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


@api_router.post("/accounts", response_model=AccountActionResponse)
async def create_or_update_account(req: AccountCreateRequest, request: Request) -> AccountActionResponse:
    """Add or update an account manually (direct token, raw JSON, or ADC)."""
    scheduler = request.app.state.scheduler
    fetcher = scheduler.fetcher

    raw_text = req.raw_json or req.refresh_token or ""
    parsed = parse_credentials_input(raw_text)

    token = parsed.get("refresh_token") or req.refresh_token or ""
    cid = parsed.get("client_id") or req.client_id or ""
    csec = parsed.get("client_secret") or req.client_secret or ""
    pid = parsed.get("project_id") or req.project_id or ""

    if not token.strip():
        raise HTTPException(status_code=400, detail="No valid Google OAuth refresh token provided.")

    # Validate token first
    temp_acc = AccountConfig(name=req.name, refresh_token=token, client_id=cid, client_secret=csec, project_id=pid)
    access_token, err = await fetcher.refresh_access_token(temp_acc)
    if not access_token or err:
        raise HTTPException(status_code=400, detail=f"Authentication failed: {err}")

    # Fetch user info for name if default
    user_info = await fetcher.fetch_user_info(access_token)
    email = user_info.get("email")
    acc_name = req.name if req.name and req.name != "Google Account" else (email or "Google Account")

    acc_config = AccountConfig(
        name=acc_name,
        refresh_token=token,
        client_id=cid,
        client_secret=csec,
        project_id=pid,
    )

    quota = await scheduler.add_or_update_account(acc_config)
    return AccountActionResponse(
        success=True,
        message=f"Account '{acc_name}' ({email}) successfully connected and saved!",
        account=quota,
    )


@api_router.delete("/accounts/{account_name}", response_model=AccountActionResponse)
async def delete_account(account_name: str, request: Request) -> AccountActionResponse:
    """Delete an account from the system."""
    scheduler = request.app.state.scheduler
    deleted = await scheduler.delete_account(account_name)
    if not deleted:
        raise HTTPException(status_code=404, detail=f"Account '{account_name}' not found.")
    return AccountActionResponse(
        success=True,
        message=f"Account '{account_name}' successfully deleted.",
    )


@api_router.get("/oauth/auth-url", response_model=AuthUrlResponse)
async def get_oauth_auth_url(request: Request, client_id: Optional[str] = None) -> AuthUrlResponse:
    """Get standard Google OAuth authorization URL for browser sign-in."""
    fetcher = request.app.state.scheduler.fetcher
    redirect_uri = "https://sdk.cloud.google.com/applicationdefaultcredentials.html"
    auth_url = fetcher.get_auth_url(client_id=client_id, redirect_uri=redirect_uri)
    return AuthUrlResponse(
        auth_url=auth_url,
        client_id=client_id or "",
        redirect_uri=redirect_uri,
    )


@api_router.post("/oauth/device/start", response_model=DeviceAuthStartResponse)
async def start_device_auth(req: DeviceAuthStartRequest, request: Request) -> DeviceAuthStartResponse:
    """Start Google OAuth 2.0 Device Code Flow."""
    fetcher = request.app.state.scheduler.fetcher
    try:
        return await fetcher.start_device_flow(client_id=req.client_id, client_secret=req.client_secret)
    except Exception as ex:
        _LOGGER.error("Device auth initiation failed: %s", ex)
        raise HTTPException(status_code=500, detail=str(ex))


@api_router.post("/oauth/device/poll", response_model=DeviceAuthPollResponse)
async def poll_device_auth(req: DeviceAuthPollRequest, request: Request) -> DeviceAuthPollResponse:
    """Poll Google OAuth token endpoint for Device Flow completion."""
    scheduler = request.app.state.scheduler
    fetcher = scheduler.fetcher

    status, refresh_token, access_token, err = await fetcher.poll_device_flow(
        device_code=req.device_code,
        client_id=req.client_id,
        client_secret=req.client_secret,
    )

    if status == "success" and refresh_token:
        # Get user email
        user_info = await fetcher.fetch_user_info(access_token or "")
        email = user_info.get("email")
        acc_name = (
            req.account_name
            if req.account_name and req.account_name != "Google Account"
            else (email or "Google Account")
        )

        acc_config = AccountConfig(
            name=acc_name,
            refresh_token=refresh_token,
            client_id=req.client_id or "",
            client_secret=req.client_secret or "",
            project_id=req.project_id or "",
        )

        await scheduler.add_or_update_account(acc_config)
        return DeviceAuthPollResponse(
            status="success",
            message=f"Successfully authenticated as {email}!",
            account_name=acc_name,
            email=email,
        )

    return DeviceAuthPollResponse(
        status=status,
        message=err or "Waiting for confirmation...",
    )


@api_router.post("/oauth/exchange", response_model=AccountActionResponse)
async def exchange_auth_code(req: AuthCodeExchangeRequest, request: Request) -> AccountActionResponse:
    """Exchange manual authorization code for a refresh token and save account."""
    scheduler = request.app.state.scheduler
    fetcher = scheduler.fetcher

    refresh_token, access_token, err = await fetcher.exchange_auth_code(
        code=req.code,
        redirect_uri=req.redirect_uri or "urn:ietf:wg:oauth:2.0:oob",
        client_id=req.client_id,
        client_secret=req.client_secret,
    )

    if not refresh_token or err:
        raise HTTPException(status_code=400, detail=err or "Code exchange failed.")

    user_info = await fetcher.fetch_user_info(access_token or "")
    email = user_info.get("email")
    acc_name = (
        req.account_name if req.account_name and req.account_name != "Google Account" else (email or "Google Account")
    )

    acc_config = AccountConfig(
        name=acc_name,
        refresh_token=refresh_token,
        client_id=req.client_id or "",
        client_secret=req.client_secret or "",
        project_id=req.project_id or "",
    )

    quota = await scheduler.add_or_update_account(acc_config)
    return AccountActionResponse(
        success=True,
        message=f"Account '{acc_name}' ({email}) successfully connected!",
        account=quota,
    )


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
