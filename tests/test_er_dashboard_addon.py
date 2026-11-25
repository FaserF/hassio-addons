"""Tests validating er-dashboard s6 banner injection and multi-service boot-loop protection."""

import importlib.util
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
ER_S6 = REPO_ROOT / "er-dashboard" / "rootfs" / "etc" / "s6-overlay" / "s6-rc.d"
INJECT_SCRIPT = REPO_ROOT / ".scripts" / "inject_version_warning.py"
SHARED_BANNER = REPO_ROOT / ".scripts" / "bashio" / "banner.sh"


def _load_inject_module():
    spec = importlib.util.spec_from_file_location("inject_version_warning", INJECT_SCRIPT)
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(module)
    return module


def test_er_dashboard_banner_only_in_init_secrets() -> None:
    """Verify only init-secrets carries banner injection so 4 s6 scripts never quadruple-count boots."""
    assert "<App_BANNER_INJECTION>" in (ER_S6 / "init-secrets" / "run").read_text(encoding="utf-8")
    for aux in ("init-postgres", "init-backend", "svc-nginx"):
        content = (ER_S6 / aux / "run").read_text(encoding="utf-8")
        assert "<App_BANNER_INJECTION>" not in content, f"{aux}/run must not duplicate banner injection"
        assert "_show_app_banner" not in content, f"{aux}/run must not define or run _show_app_banner"


def test_find_run_script_er_dashboard_deterministic() -> None:
    """Verify find_run_script deterministically resolves er-dashboard to init-secrets/run."""
    mod = _load_inject_module()
    resolved = mod.find_run_script(str(REPO_ROOT / "er-dashboard"))
    assert resolved is not None
    assert Path(resolved).resolve() == (ER_S6 / "init-secrets" / "run").resolve()


def test_boot_loop_protection_container_scoped() -> None:
    """Verify generated banner and shared bashio banner guard boot-loop count with /run/.boot_loop_lock."""
    mod = _load_inject_module()
    generated = mod.generate_startup_banner_code({"name": "Test", "slug": "test", "folder": "test"}, False)
    assert "/run/.boot_loop_lock" in generated
    assert "/run/.boot_loop_owner" in generated
    shared = SHARED_BANNER.read_text(encoding="utf-8")
    assert "/run/.boot_loop_lock" in shared
    assert "/run/.boot_loop_owner" in shared
