"""Tests validating dbf addon configuration, scripts, and injection targets."""

import sys
from pathlib import Path

import yaml

REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT / ".scripts"))

from inject_version_warning import find_run_script  # noqa: E402

DBF_DIR = REPO_ROOT / "dbf"
PERIODIC_RUN = DBF_DIR / "rootfs" / "etc" / "s6-overlay" / "s6-rc.d" / "dbf-periodic" / "run"
MAIN_RUN = DBF_DIR / "rootfs" / "etc" / "s6-overlay" / "s6-rc.d" / "dbf" / "run"


def test_periodic_run_exists() -> None:
    """Verify dbf-periodic run script exists."""
    assert PERIODIC_RUN.is_file(), "dbf-periodic/run must exist"


def test_periodic_run_no_invalid_crond_args() -> None:
    """Verify crond is not called with invalid conflicting flags such as -d -l."""
    content = PERIODIC_RUN.read_text(encoding="utf-8")
    assert (
        "-d -l" not in content
    ), "crond must not be called with '-d -l' as busybox crond treats -l as the numeric argument for -d"
    assert (
        "crond -f -l 0 -L /proc/self/fd/1" in content
    ), "Debug/trace mode must call crond with -l 0 -L /proc/self/fd/1"
    assert "crond -f -l 9 -L /dev/null" in content, "Normal mode must suppress crond noise via -l 9 -L /dev/null"


def test_periodic_run_no_banner_injection() -> None:
    """Verify dbf-periodic does not run app banner or duplicate boot loop protection."""
    content = PERIODIC_RUN.read_text(encoding="utf-8")
    assert (
        "<App_BANNER_INJECTION>" not in content
    ), "dbf-periodic must not have banner injection; banner belongs in main dbf/run"
    assert "_show_app_banner" not in content, "dbf-periodic must not define or run _show_app_banner"


def test_find_run_script_targets_main_service() -> None:
    """Verify find_run_script targets dbf/run rather than dbf-periodic/run."""
    run_script = find_run_script(str(DBF_DIR))
    assert run_script is not None
    assert (
        Path(run_script).resolve() == MAIN_RUN.resolve()
    ), "find_run_script for dbf must resolve to dbf/run, not an auxiliary service"


def test_s6_dependencies_present() -> None:
    """Verify s6 dependencies prevent race condition with log level initialization."""
    for service in ("dbf", "dbf-periodic"):
        dep_file = DBF_DIR / "rootfs" / "etc" / "s6-overlay" / "s6-rc.d" / service / "dependencies"
        assert dep_file.is_file(), f"{service} must have dependencies file"
        content = dep_file.read_text(encoding="utf-8").strip()
        assert "base-addon-log-level" in content


def test_dbf_lookahead_option_and_export() -> None:
    """Verify lookahead option, schema, translations, and DBFAKEDISPLAY_LOOKAHEAD export."""
    config = yaml.safe_load((DBF_DIR / "config.yaml").read_text(encoding="utf-8"))
    assert config["options"]["lookahead"] == 180
    assert config["schema"]["lookahead"] == "int(60,1440)?"

    for lang in ("en", "de"):
        trans = yaml.safe_load((DBF_DIR / "translations" / f"{lang}.yaml").read_text(encoding="utf-8"))
        assert "lookahead" in trans["configuration"], f"Missing lookahead translation in {lang}.yaml"

    run_content = MAIN_RUN.read_text(encoding="utf-8")
    assert "bashio::config 'lookahead' '180'" in run_content
    assert 'export DBFAKEDISPLAY_LOOKAHEAD="${LOOKAHEAD}"' in run_content
