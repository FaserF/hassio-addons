"""Tests validating EntraMirror addon configuration and port mapping."""

from pathlib import Path

import yaml

REPO_ROOT = Path(__file__).resolve().parent.parent
ENTRAMIRROR_CONFIG = REPO_ROOT / ".dev" / "EntraMirror" / "config.yaml"


def test_entramirror_optional_host_port_with_ingress() -> None:
    """Verify host port 8094/tcp defaults to null while Ingress remains enabled on 8094."""
    config = yaml.safe_load(ENTRAMIRROR_CONFIG.read_text(encoding="utf-8"))
    assert config["ingress"] is True
    assert config["ingress_port"] == 8094
    assert config["ports"]["8094/tcp"] is None
