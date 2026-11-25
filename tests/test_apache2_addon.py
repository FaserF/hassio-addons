"""Tests validating apache2 and apache2-minimal-mariadb PHP version pinning and CVE fixes."""

import json
import re
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
RENOVATE_PATH = REPO_ROOT / ".github" / "renovate.json"


def test_apache2_dockerfiles_pin_php85_and_upgrade_from_edge() -> None:
    """Verify apache2 Dockerfiles pin PHP 8.5 and pull php85 packages from Alpine edge (>= 8.5.13)."""
    for slug in ("apache2", "apache2-minimal-mariadb"):
        dockerfile = (REPO_ROOT / slug / "Dockerfile").read_text(encoding="utf-8")
        match = re.search(r'^ARG\s+PHP_VERSION="([^"]+)"', dockerfile, re.MULTILINE)
        assert match is not None, f"PHP_VERSION ARG missing in {slug}/Dockerfile"
        assert match.group(1) == "8.5", f"Expected PHP_VERSION='8.5' in {slug}/Dockerfile"
        assert "@edge http://dl-cdn.alpinelinux.org/alpine/edge/community" in dockerfile
        assert '"php${PHP_V}-common@edge"' in dockerfile
        assert '"php${PHP_V}@edge"' in dockerfile
        assert '"php${PHP_V}-apache2@edge"' in dockerfile


def test_renovate_restricts_php_below_86() -> None:
    """Verify Renovate restricts php/php-src below 8.6 until Alpine ships php86."""
    renovate = json.loads(RENOVATE_PATH.read_text(encoding="utf-8"))
    rules = [rule for rule in renovate.get("packageRules", []) if "php/php-src" in rule.get("matchDepNames", [])]
    assert rules
    assert any(rule.get("allowedVersions") == "<8.6" for rule in rules)
