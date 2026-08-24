import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".scripts")))

from cleanup_migration_helpers import clean_source_content


def test_clean_block():
    c = """# Header
# <TEMP_MIGRATION_HELPER:REMOVE_ON_RELEASE>
bashio::app.auto_migrate_data "alivro" || true
# </TEMP_MIGRATION_HELPER:REMOVE_ON_RELEASE>
# Footer
"""
    cl, ch = clean_source_content(c)
    assert ch is True
    assert "auto_migrate_data" not in cl
    assert "# <TEMP_MIGRATION_HELPER:REMOVE_ON_RELEASE>" not in cl
    assert "# Footer" in cl


def test_clean_perm():
    c = """map:
  - config:rw
  - share:rw # <TEMP_MIGRATION_PERMISSION:REMOVE_ON_RELEASE>
options:
  log_level: info
"""
    cl, ch = clean_source_content(c)
    assert ch is True
    assert "share:rw" not in cl
    assert "config:rw" in cl
    assert "options:" in cl


def test_clean_no_ch():
    c = """map:
  - config:rw
options:
  log_level: info
"""
    cl, ch = clean_source_content(c)
    assert ch is False
    assert cl == c


if __name__ == "__main__":
    test_clean_block()
    test_clean_perm()
    test_clean_no_ch()
    print("All cleanup tests passed successfully!")
