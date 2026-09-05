"""Unit tests for models in Google Antigravity Addon."""

import sys
from pathlib import Path

# Add rootfs/usr/share/antigravity to sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "rootfs" / "usr" / "share" / "antigravity"))

from app.models import (
    AccountQuota,
    CreditsStatus,
    ModelQuota,
    PlanTier,
    RollingLimit,
    SchedulerState,
    SystemStatus,
    WeeklyLimit,
)


def test_models_instantiation():
    """Test instantiating models with defaults."""
    tier = PlanTier()
    assert tier.tier_id == "pro"
    assert tier.name == "Pro Tier"

    rolling = RollingLimit(used=10, limit=50, remaining=40, used_percentage=20.0, remaining_percentage=80.0)
    assert rolling.used == 10
    assert rolling.remaining == 40

    weekly = WeeklyLimit(used=100, limit=500, remaining=400, used_percentage=20.0, remaining_percentage=80.0)
    assert weekly.used == 100

    credits_st = CreditsStatus(balance=25.0, used=5.0, display="$25.00 available")
    assert credits_st.balance == 25.0

    model_q = ModelQuota(
        model_id="gemini-2.5-pro",
        display_name="Gemini 2.5 Pro",
        requests_used=20,
        requests_limit=100,
        used_percentage=20.0,
        remaining_percentage=80.0,
    )
    assert model_q.model_id == "gemini-2.5-pro"

    account = AccountQuota(
        account_name="Primary",
        email="test@google.com",
        plan=tier,
        rolling_5h_limit=rolling,
        weekly_limit=weekly,
        credits=credits_st,
        models=[model_q],
    )
    assert account.account_name == "Primary"
    assert account.email == "test@google.com"
    assert len(account.models) == 1

    scheduler_st = SchedulerState()
    assert scheduler_st.base_interval == 1800
    assert scheduler_st.current_interval == 1800

    sys_status = SystemStatus(
        accounts_count=1,
        active_account="Primary",
        accounts=[account],
        scheduler=scheduler_st,
    )
    assert sys_status.status == "online"
    assert sys_status.accounts_count == 1
