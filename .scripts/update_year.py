#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Update year references from previous year to current year in README and LICENSE files.
This script is designed to be run annually on January 1st.
"""

import os
import re
import sys
from datetime import datetime
from pathlib import Path


def get_current_year():
    """Get the current year."""
    return datetime.now().year


def get_previous_year():
    """Get the previous year."""
    return get_current_year() - 1


def update_license_file(license_path, old_year, new_year):
    """Update copyright year in LICENSE files."""
    if not os.path.exists(license_path):
        return False

    with open(license_path, "r", encoding="utf-8") as f:
        content = f.read()

    original_content = content

    # Update copyright years: 2019–2025 -> 2019–2026, or any year range ending with old_year
    content = re.sub(rf"(\d{{4}})–{old_year}", rf"\1–{new_year}", content)
    content = re.sub(
        rf"\(c\)\s*(\d{{4}})–{old_year}",
        rf"(c) \1–{new_year}",
        content,
        flags=re.IGNORECASE,
    )
    content = re.sub(
        rf"Copyright\s+\(c\)\s*(\d{{4}})–{old_year}",
        rf"Copyright (c) \1–{new_year}",
        content,
        flags=re.IGNORECASE,
    )
    # Also handle single year references in copyright contexts only (e.g., "Copyright 2025", "© 2025", "(c) 2025")
    content = re.sub(
        rf"(?:Copyright(?:\s+\(c\))?|©|\(c\)|\(C\))\s+{old_year}\b",
        lambda m: m.group(0).replace(str(old_year), str(new_year)),
        content,
        flags=re.IGNORECASE,
    )

    if content != original_content:
        with open(license_path, "w", encoding="utf-8") as f:
            f.write(content)
        return True
    return False


def update_readme_md(readme_path, old_year, new_year):
    """Update year references in main README.MD file."""
    if not os.path.exists(readme_path):
        return False

    with open(readme_path, "r", encoding="utf-8") as f:
        content = f.read()

    original_content = content

    # Update date format "YYYY-MM" in table (e.g., "2025-12" -> "2026-01")
    # Only update if it's the last month of the old year
    content = re.sub(rf"{old_year}-12", f"{new_year}-01", content)
    # Update any standalone year references in copyright notices
    content = re.sub(
        rf"Copyright.*{old_year}",
        lambda m: m.group(0).replace(str(old_year), str(new_year)),
        content,
        flags=re.IGNORECASE,
    )

    if content != original_content:
        with open(readme_path, "w", encoding="utf-8") as f:
            f.write(content)
        return True
    return False


def main():
    """Main function to update all year references.

    Returns:
        int: Exit code
            - 0: Changes were made
            - 1: No changes needed
            - 2: Error occurred
    """
    try:
        old_year = get_previous_year()
        new_year = get_current_year()

        print(f"Updating year references from {old_year} to {new_year}...")

        repo_root = Path(__file__).parent.parent
        os.chdir(repo_root)

        updated_files = []

        # Update main README.MD
        main_readme = repo_root / "README.MD"
        if update_readme_md(str(main_readme), old_year, new_year):
            updated_files.append("README.MD")
            print("[OK] Updated README.MD")

        # Find and update all LICENSE.txt files
        license_files = list(repo_root.rglob("LICENSE.txt"))
        for license_file in license_files:
            # Skip if in .git or other hidden directories
            if any(
                part.startswith(".") and part != ".unsupported"
                for part in license_file.parts
            ):
                continue

            if update_license_file(str(license_file), old_year, new_year):
                rel_path = license_file.relative_to(repo_root)
                updated_files.append(str(rel_path))
                print(f"[OK] Updated {rel_path}")

        # Also check for LICENSE files without .txt extension
        license_files_alt = list(repo_root.rglob("LICENSE"))
        for license_file in license_files_alt:
            if license_file.suffix:  # Skip if has extension
                continue
            # Skip if in .git or other hidden directories
            if any(
                part.startswith(".") and part != ".unsupported"
                for part in license_file.parts
            ):
                continue

            if update_license_file(str(license_file), old_year, new_year):
                rel_path = license_file.relative_to(repo_root)
                updated_files.append(str(rel_path))
                print(f"[OK] Updated {rel_path}")

        print(f"\n[SUCCESS] Updated {len(updated_files)} file(s)")
        if updated_files:
            print("Files updated:")
            for f in updated_files:
                print(f"  - {f}")

        # Return exit code: 0 = changes made, 1 = no changes needed
        return 0 if updated_files else 1

    except (FileNotFoundError, PermissionError, OSError) as e:
        # Handle file system errors specifically
        print(f"\n[ERROR] File system error: {type(e).__name__}: {e}", file=sys.stderr)
        import traceback

        traceback.print_exc()
        return 2
    except (ValueError, TypeError) as e:
        # Handle data/type errors specifically
        print(f"\n[ERROR] Data error: {type(e).__name__}: {e}", file=sys.stderr)
        import traceback

        traceback.print_exc()
        return 2
    except Exception as e:
        # Catch-all for any other unexpected errors
        print(f"\n[ERROR] Unexpected error ({type(e).__name__}): {e}", file=sys.stderr)
        import traceback

        traceback.print_exc()
        return 2


if __name__ == "__main__":
    exit_code = main()
    sys.exit(exit_code)
