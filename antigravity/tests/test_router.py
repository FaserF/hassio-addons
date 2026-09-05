"""Unit tests for REST API routes in Google Antigravity Addon."""

import sys
from pathlib import Path

import pytest
from httpx import ASGITransport, AsyncClient

# Add rootfs/usr/share/antigravity to sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "rootfs" / "usr" / "share" / "antigravity"))

from app.main import app
from app.models import AccountConfig
from app.scheduler import DynamicScheduler


@pytest.fixture
def mock_app_state():
    """Setup app state with scheduler for testing."""
    accounts = [
        AccountConfig(name="Primary Account", refresh_token=""),
        AccountConfig(name="Secondary Account", refresh_token=""),
    ]
    scheduler = DynamicScheduler(accounts=accounts)
    app.state.scheduler = scheduler
    return scheduler


@pytest.mark.asyncio
async def test_api_status_and_accounts(mock_app_state):
    """Test /api/status and /api/accounts endpoints."""
    await mock_app_state.poll_all_accounts()

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        res = await client.get("/api/status")
        assert res.status_code == 200
        data = res.json()
        assert data["version"] == "0.1.0"
        assert data["accounts_count"] == 2

        res_accounts = await client.get("/api/accounts")
        assert res_accounts.status_code == 200
        accounts_data = res_accounts.json()
        assert len(accounts_data) == 2


@pytest.mark.asyncio
async def test_api_single_account_quota(mock_app_state):
    """Test getting single account quota."""
    await mock_app_state.poll_all_accounts()

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        res = await client.get("/api/accounts/Primary%20Account/quota")
        assert res.status_code == 200
        quota = res.json()
        assert quota["account_name"] == "Primary Account"

        # Not found
        res_404 = await client.get("/api/accounts/NonExistent/quota")
        assert res_404.status_code == 404


@pytest.mark.asyncio
async def test_api_refresh(mock_app_state):
    """Test manual refresh endpoints."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        res = await client.post("/api/refresh", json={"force": True})
        assert res.status_code == 200
        data = res.json()
        assert data["accounts_count"] == 2


@pytest.mark.asyncio
async def test_health_endpoints(mock_app_state):
    """Test health probes."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        res = await client.get("/healthz")
        assert res.status_code == 200
        assert res.json()["status"] == "ok"

        res_api_health = await client.get("/api/health")
        assert res_api_health.status_code == 200
        assert res_api_health.json()["status"] == "ok"
