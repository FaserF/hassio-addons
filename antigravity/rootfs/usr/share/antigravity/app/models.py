"""Data models and schemas for Google Antigravity Home Assistant Addon."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import List, Optional

from pydantic import BaseModel, Field


class PlanTier(BaseModel):
    """Information about the Antigravity plan/tier."""

    tier_id: str = Field(
        default="pro", description="Identifier of the tier (free, pro, ultra, enterprise, early_access)"
    )
    name: str = Field(default="Pro Tier", description="Human-readable display name")
    badge_color: str = Field(default="#6366f1", description="HEX color string for badge UI display")
    is_early_access: bool = Field(default=True, description="Whether the account is enrolled in early access")


class RollingLimit(BaseModel):
    """5-Hour rolling window request and quota limit."""

    used: int = Field(default=0, description="Requests consumed in current 5-hour window")
    limit: int = Field(default=0, description="Total request limit for 5-hour window")
    remaining: int = Field(default=0, description="Remaining requests in current window")
    used_percentage: float = Field(default=0.0, description="Percentage of window quota used (0-100)")
    remaining_percentage: float = Field(default=100.0, description="Percentage of window quota remaining (0-100)")
    resets_at: Optional[str] = Field(
        default=None, description="ISO timestamp when the rolling quota window resets/slides"
    )
    reset_in_seconds: int = Field(default=0, description="Seconds until window reset or next sliding token")
    reset_display: str = Field(default="--", description="Human-readable reset countdown")


class WeeklyLimit(BaseModel):
    """Weekly quota limit and reset schedule."""

    used: int = Field(default=0, description="Total requests consumed this week")
    limit: int = Field(default=0, description="Total weekly request quota limit")
    remaining: int = Field(default=0, description="Remaining weekly requests")
    used_percentage: float = Field(default=0.0, description="Percentage of weekly quota used (0-100)")
    remaining_percentage: float = Field(default=100.0, description="Percentage of weekly quota remaining (0-100)")
    resets_at: Optional[str] = Field(default=None, description="ISO timestamp of the weekly reset")
    reset_in_seconds: int = Field(default=0, description="Seconds until weekly reset")
    reset_display: str = Field(default="--", description="Human-readable weekly reset countdown")


class ModelQuota(BaseModel):
    """Quota usage for an individual AI model."""

    model_id: str = Field(..., description="Unique model identifier, e.g., gemini-2.5-pro")
    display_name: str = Field(..., description="Human-readable model name")
    requests_used: int = Field(default=0, description="Requests consumed for this model")
    requests_limit: int = Field(default=100, description="Request limit for this model")
    used_percentage: float = Field(default=0.0, description="Percentage used (0-100)")
    remaining_percentage: float = Field(default=100.0, description="Percentage remaining (0-100)")
    status: str = Field(default="OK", description="Status: OK, Warning, Exhausted")


class CreditsStatus(BaseModel):
    """Antigravity / Google Cloud AI credits status."""

    balance: float = Field(default=0.0, description="Remaining credit balance amount")
    currency: str = Field(default="USD", description="Currency symbol or name")
    used: float = Field(default=0.0, description="Total credits consumed")
    display: str = Field(default="$0.00", description="Formatted credit string")
    status: str = Field(default="Active", description="Credits status: Active, Warning, Depleted, Inactive")


class AccountConfig(BaseModel):
    """Configuration for a Google Antigravity account."""

    name: str = Field(default="Primary Account", description="User-friendly name for this account")
    refresh_token: str = Field(default="", description="OAuth2 refresh token")
    client_id: Optional[str] = Field(default="", description="Google OAuth Client ID")
    client_secret: Optional[str] = Field(default="", description="Google OAuth Client Secret")
    project_id: Optional[str] = Field(default="", description="Google Cloud Project ID")


class AccountQuota(BaseModel):
    """Complete quota state for an account."""

    account_name: str = Field(..., description="Account identifier / name")
    email: str = Field(default="Not configured", description="Google user email")
    project_id: str = Field(default="", description="Associated Project ID")
    plan: PlanTier = Field(default_factory=PlanTier)
    rolling_5h_limit: RollingLimit = Field(default_factory=RollingLimit)
    weekly_limit: WeeklyLimit = Field(default_factory=WeeklyLimit)
    credits: CreditsStatus = Field(default_factory=CreditsStatus)
    models: List[ModelQuota] = Field(default_factory=list)
    status: str = Field(
        default="unconfigured", description="Account health: active, rate_limited, unauthenticated, unconfigured, error"
    )
    is_demo: bool = Field(default=False, description="Whether this account is operating in simulated demo mode")
    error_message: Optional[str] = Field(default=None, description="Error detail if status is error or unconfigured")
    last_updated: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class SchedulerState(BaseModel):
    """Status and metrics of the adaptive polling scheduler."""

    base_interval: int = Field(default=1800, description="Configured base scan interval in seconds")
    current_interval: int = Field(default=1800, description="Currently active polling interval in seconds")
    fast_interval: int = Field(default=180, description="Fast polling interval in seconds when activity detected")
    idle_interval: int = Field(default=3600, description="Idle backoff polling interval in seconds")
    is_adaptive: bool = Field(default=True, description="Whether adaptive polling is enabled")
    is_fast_polling: bool = Field(default=False, description="True if currently polling at high frequency")
    last_polled_at: Optional[str] = Field(default=None, description="ISO timestamp of last successful poll")
    next_poll_at: Optional[str] = Field(default=None, description="ISO timestamp of scheduled next poll")
    seconds_until_next_poll: int = Field(default=0, description="Seconds remaining until next automatic poll")
    recent_activity_detected: bool = Field(default=False, description="True if quota usage changed in last 15 min")
    last_change_at: Optional[str] = Field(default=None, description="ISO timestamp of last detected quota delta")


class SystemStatus(BaseModel):
    """Aggregated system and quota status response."""

    version: str = Field(default="0.1.0", description="Addon software version")
    status: str = Field(default="online", description="Overall addon status: online, degraded, error")
    accounts_count: int = Field(default=0, description="Total number of configured accounts")
    active_account: str = Field(default="", description="Name of the currently selected / primary account")
    accounts: List[AccountQuota] = Field(default_factory=list, description="List of all accounts and their quotas")
    scheduler: SchedulerState = Field(default_factory=SchedulerState, description="Scheduler state")


class RefreshRequest(BaseModel):
    """Request payload for manual quota refresh."""

    account_name: Optional[str] = Field(default=None, description="Specific account name to refresh, or None for all")
    force: bool = Field(default=True, description="Force fetch even if cache is fresh")


class CredentialsTestRequest(BaseModel):
    """Request payload to validate pasted credentials or JSON in UI."""

    refresh_token: Optional[str] = Field(default=None, description="Direct OAuth refresh token")
    client_id: Optional[str] = Field(default=None, description="Optional Client ID")
    client_secret: Optional[str] = Field(default=None, description="Optional Client Secret")
    raw_json: Optional[str] = Field(default=None, description="Raw JSON content of oauth_creds.json or ADC")


class AuthUrlResponse(BaseModel):
    """Response containing generated Google OAuth authorization URL."""

    auth_url: str
    client_id: str
    redirect_uri: str


class DeviceAuthStartRequest(BaseModel):
    """Request to initiate Google OAuth Device Flow."""

    client_id: Optional[str] = Field(default=None, description="Custom Client ID, or default if blank")
    client_secret: Optional[str] = Field(default=None, description="Custom Client Secret, or default if blank")


class DeviceAuthStartResponse(BaseModel):
    """Response from initiating Google OAuth Device Flow."""

    device_code: str
    user_code: str
    verification_url: str
    expires_in: int
    interval: int


class DeviceAuthPollRequest(BaseModel):
    """Request to poll for Device Flow completion."""

    device_code: str
    account_name: str = Field(default="Google Account")
    client_id: Optional[str] = Field(default=None)
    client_secret: Optional[str] = Field(default=None)
    project_id: Optional[str] = Field(default=None)


class DeviceAuthPollResponse(BaseModel):
    """Response from polling Device Flow status."""

    status: str  # pending, success, slow_down, expired, error
    message: str
    account_name: Optional[str] = None
    email: Optional[str] = None


class AuthCodeExchangeRequest(BaseModel):
    """Request to exchange authorization code for refresh token."""

    code: str
    redirect_uri: Optional[str] = Field(default="urn:ietf:wg:oauth:2.0:oob")
    account_name: str = Field(default="Google Account")
    client_id: Optional[str] = Field(default=None)
    client_secret: Optional[str] = Field(default=None)
    project_id: Optional[str] = Field(default=None)


class AccountCreateRequest(BaseModel):
    """Request to create or update an account manually."""

    name: str = Field(..., description="Account display name")
    refresh_token: Optional[str] = Field(default="", description="OAuth refresh token")
    client_id: Optional[str] = Field(default="")
    client_secret: Optional[str] = Field(default="")
    project_id: Optional[str] = Field(default="")
    raw_json: Optional[str] = Field(default="", description="Raw JSON from ADC or credentials file")


class AccountActionResponse(BaseModel):
    """Generic action response for account creation, deletion, or update."""

    success: bool
    message: str
    account: Optional[AccountQuota] = None
