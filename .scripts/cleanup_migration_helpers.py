"""Cleanup temporary cross-channel migration helpers and permissions once an add-on is released or matured.
1. Scans files for <TEMP_MIGRATION_HELPER:REMOVE_ON_RELEASE> and <TEMP_MIGRATION_PERMISSION:REMOVE_ON_RELEASE>.
2. Removes blocks automatically.
"""

import argparse
import os
import re


BLOCK_PATTERN = re.compile(
    r"[ \t]*# <TEMP_MIGRATION_HELPER:REMOVE_ON_RELEASE>.*?[ \t]*# </TEMP_MIGRATION_HELPER:REMOVE_ON_RELEASE>\r?\n?",
    re.DOTALL,
)

LINE_PATTERN = re.compile(
    r"^.*?[ \t]*# <TEMP_MIGRATION_PERMISSION:REMOVE_ON_RELEASE>.*$\r?\n?",
    re.MULTILINE,
)



def clean_source_content(content: str) -> tuple[str, bool]:
    original = content
    content = BLOCK_PATTERN.sub("", content)
    content = LINE_PATTERN.sub("", content)
    return content, content != original


def process_file(file_path: str, dry_run: bool = False) -> bool:
    if not os.path.exists(file_path):
        return False
    with open(file_path, "r", encoding="utf-8") as file:
        content = file.read()

    new_content, changed = clean_source_content(content)
    if changed:
        print(f"[CLEANUP] Removing migration helpers from: {file_path}")
        if not dry_run:
            with open(file_path, "w", encoding="utf-8") as file:
                file.write(new_content)
    return changed


def run_cleanup(app_dir: str | None = None, dry_run: bool = False) -> int:
    total_changed = 0
    roots_to_scan = [app_dir] if app_dir else [".", ".dev"]

    for root_dir in roots_to_scan:
        if not os.path.exists(root_dir):
            continue
        for root, unused_dirs, files in os.walk(root_dir):
            if ".git" in root or ".venv" in root:
                continue
            for filename in files:
                if filename.endswith((".sh", ".yaml", ".yml")):
                    file_path = os.path.join(root, filename)
                    if process_file(file_path, dry_run):
                        total_changed += 1

    print(f"Cleaned {total_changed} file(s).")
    return total_changed


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--app", default=None, help="Specific app directory")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    run_cleanup(app_dir=args.app, dry_run=args.dry_run)
