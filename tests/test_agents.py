"""Tests validating AGENTS.MD rules, guidelines, and referenced architecture."""

import re
import unittest
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
AGENTS_MD = REPO_ROOT / "AGENTS.MD"


class TestAgentsMd(unittest.TestCase):
    def test_agents_markdown_exists_and_not_empty(self) -> None:
        """Ensure AGENTS.MD exists at repository root and has content."""
        self.assertTrue(AGENTS_MD.is_file(), "AGENTS.MD must exist at root")
        content = AGENTS_MD.read_text(encoding="utf-8")
        self.assertGreater(len(content.strip()), 0, "AGENTS.MD must not be empty")

    def test_agents_manifest_files_exist(self) -> None:
        """Ensure key manifest / connection files referenced in AGENTS.MD exist."""
        content = AGENTS_MD.read_text(encoding="utf-8")
        referenced_files = ["project_manifest.json", "project_connections.json"]
        for filename in referenced_files:
            if f"`{filename}`" in content:
                self.assertTrue(
                    (REPO_ROOT / filename).exists(),
                    f"File '{filename}' must exist at root",
                )

    def test_agents_key_addons_exist(self) -> None:
        """Ensure all key addons referenced in AGENTS.MD table exist with config.yaml."""
        content = AGENTS_MD.read_text(encoding="utf-8")
        matches = re.findall(r"\|\s*`([A-Za-z0-9_-]+)`\s*\|", content)
        self.assertTrue(matches, "Expected addon slugs in AGENTS.MD table")

        for slug in matches:
            addon_dir = REPO_ROOT / slug
            if addon_dir.is_dir():
                config_file = addon_dir / "config.yaml"
                self.assertTrue(
                    config_file.exists(),
                    f"Addon '{slug}' must contain a config.yaml",
                )

    def test_agents_no_unsupported_markdown_alerts(self) -> None:
        """Ensure AGENTS.MD adheres to standard markdown without broken alert syntax."""
        unsupported_alerts = re.compile(r"\[!(TIP|NOTE|WARNING|CAUTION|IMPORTANT)\]", re.IGNORECASE)
        content = AGENTS_MD.read_text(encoding="utf-8")

        errors = [
            f"Line {idx + 1}: {line.strip()}"
            for idx, line in enumerate(content.splitlines())
            if unsupported_alerts.search(line)
        ]
        self.assertFalse(errors, f"Unsupported markdown alerts in AGENTS.MD: {errors}")


if __name__ == "__main__":
    unittest.main()
