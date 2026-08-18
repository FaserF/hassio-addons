"""Unit tests for fetcher in Google Antigravity Addon."""

import sys
from pathlib import Path

import pytest

# Add rootfs/usr/share/antigravity to sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "rootfs" / "usr" / "share" / "antigravity"))

from app.fetcher import AntigravityFetcher, format_duration, parse_credentials_input
from app.models import AccountConfig, CredentialsTestRequest


def test_format_duration():
    """Test format_duration helper."""
    assert format_duration(0) == "0m"
    assert format_duration(300) == "5m"
    assert format_duration(3600) == "1h 00m"
    assert format_duration(8100) == "2h 15m"
    assert format_duration(90000) == "1d 01h"


def test_parse_credentials_input():
    """Test parsing raw strings and JSON credentials."""
    # Plain token
    res1 = parse_credentials_input("1//my_refresh_token_string")
    assert res1["refresh_token"] == "1//my_refresh_token_string"

    # Authorized user JSON
    json_str = '{"refresh_token": "token123", "client_id": "cid123", "client_secret": "csec123"}'
    res2 = parse_credentials_input(json_str)
    assert res2["refresh_token"] == "token123"
    assert res2["client_id"] == "cid123"

    # Installed app JSON
    json_app = '{"installed": {"client_id": "app_cid", "client_secret": "app_csec"}}'
    res3 = parse_credentials_input(json_app)
    assert res3["client_id"] == "app_cid"
    assert res3["client_secret"] == "app_csec"


@pytest.mark.asyncio
async def test_fetcher_demo_quota():
    """Test fetching quota in unconfigured demo mode."""
    fetcher = AntigravityFetcher()
    acc = AccountConfig(name="Demo Account", refresh_token="")
    quota, changed = await fetcher.fetch_quota(acc, None)

    assert quota.account_name == "Demo Account"
    assert quota.rolling_5h_limit.limit == 50
    assert quota.weekly_limit.limit == 500
    assert len(quota.models) > 0
    assert changed is True


@pytest.mark.asyncio
async def test_fetcher_test_credentials_empty():
    """Test credential validation with empty token."""
    fetcher = AntigravityFetcher()
    req = CredentialsTestRequest(refresh_token="")
    res = await fetcher.test_credentials(req)
    assert res["valid"] is False
