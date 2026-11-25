"""Tests validating wiki.js addon version pinning, entrypoint, and Renovate rules."""

import json
import re
from pathlib import Path

import yaml

REPO_ROOT = Path(__file__).resolve().parent.parent
WIKIJS_DIR = REPO_ROOT / "wiki.js"
RENOVATE_PATH = REPO_ROOT / ".github" / "renovate.json"


def test_wikijs_dockerfile_pins_v2() -> None:
    """Verify wiki.js Dockerfile uses a Wiki.js 2.x base tag containing /wiki/server."""
    dockerfile = (WIKIJS_DIR / "Dockerfile").read_text(encoding="utf-8")
    match = re.search(r"^ARG\s+WIKIJS_VERSION=([^\s]+)", dockerfile, re.MULTILINE)
    assert match is not None, "WIKIJS_VERSION ARG must be defined in wiki.js/Dockerfile"
    version = match.group(1).strip("\"'")
    assert version.startswith("2."), f"Expected Wiki.js v2.x tag, found {version!r}"


def test_wikijs_entrypoint_compatibility() -> None:
    """Verify wiki.js run.sh uses the v2 /wiki/server entrypoint and matches config version."""
    run_sh = (WIKIJS_DIR / "run.sh").read_text(encoding="utf-8")
    assert "cd /wiki" in run_sh
    assert "exec node server" in run_sh

    config = yaml.safe_load((WIKIJS_DIR / "config.yaml").read_text(encoding="utf-8"))
    dockerfile = (WIKIJS_DIR / "Dockerfile").read_text(encoding="utf-8")
    assert f'ENV APP_VERSION="{config["version"]}"' in dockerfile


def test_wikijs_renovate_restricts_v3() -> None:
    """Verify Renovate restricts ghcr.io/requarks/wiki in wiki.js/Dockerfile to <3.0.0."""
    renovate = json.loads(RENOVATE_PATH.read_text(encoding="utf-8"))
    rules = [
        rule
        for rule in renovate.get("packageRules", [])
        if "wiki.js/Dockerfile" in rule.get("matchFileNames", [])
        and "ghcr.io/requarks/wiki" in rule.get("matchDepNames", [])
    ]
    assert rules, "Renovate must have a packageRule restricting wiki.js/Dockerfile"
    assert any(rule.get("allowedVersions") == "<3.0.0" for rule in rules)
