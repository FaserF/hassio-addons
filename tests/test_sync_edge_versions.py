import importlib.util
import unittest
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
SCRIPT_PATH = REPO_ROOT / ".scripts" / "sync_edge_versions.py"

spec = importlib.util.spec_from_file_location("sync_edge_versions", SCRIPT_PATH)
sync_edge_versions = importlib.util.module_from_spec(spec)
spec.loader.exec_module(sync_edge_versions)
parse_semver = sync_edge_versions.parse_semver


class TestSyncEdgeVersions(unittest.TestCase):
    def test_parse_semver(self):
        self.assertEqual(parse_semver("2.1.8"), (2, 1, 8))
        self.assertEqual(parse_semver("2.1.8-dev-20261102-1338-325a5ef"), (2, 1, 8))
        self.assertEqual(parse_semver("v1.3.8-dev"), (1, 3, 8))
        self.assertEqual(parse_semver("0.1.0"), (0, 1, 0))
        self.assertTrue(parse_semver("1.3.8-dev") > parse_semver("1.3.7"))
        self.assertFalse(parse_semver("2.1.8-dev") > parse_semver("2.1.8"))


if __name__ == "__main__":
    unittest.main()
