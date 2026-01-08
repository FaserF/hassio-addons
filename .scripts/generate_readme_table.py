#!/usr/bin/env python3
"""
Generate the Add-ons List table for the main README.md.
This script reads all addon config.yaml files and generates a markdown table.

NOTE: The "Added" column in README.md is manually maintained. This script
generates a 4-column table placeholder, but the actual "Added" dates should
be preserved from the existing README.md or added manually for new add-ons.
"""

import os
import sys
from pathlib import Path

import yaml


def parse_version(version_str: str) -> tuple:
    """Parse a version string into major, minor, patch tuple."""
    try:
        parts = version_str.lstrip("v").split(".")
        return tuple(int(p) for p in parts[:3])
    except (ValueError, AttributeError):
        return (0, 0, 0)


def get_status_emoji(version: str, is_unsupported: bool) -> str:
    """Determine the status emoji based on version and support status."""
    if is_unsupported:
        return "❌"

    major, minor, patch = parse_version(version)
    if major >= 1:
        return "✅"
    else:
        return "⚠️"


def find_addons(repo_root: Path) -> list[dict]:
    """Find all addons in the repository."""
    addons = []

    # Regular addons (top-level directories or addons/ subdirectory)
    dirs_to_check = [repo_root]
    addons_dir = repo_root / "addons"
    if addons_dir.exists():
        dirs_to_check.append(addons_dir)

    for directory in dirs_to_check:
        for item in sorted(directory.iterdir()):
            # Exclude 'addons' to avoid processing the parent directory itself
            if item.is_dir() and not item.name.startswith((".", "_")) and item.name != "addons":
                config_path = item / "config.yaml"
                if config_path.exists():
                    # Calculate relative path from repo_root
                    rel_path = item.relative_to(repo_root).as_posix()
                    addons.append(
                        {"path": rel_path, "config": config_path, "unsupported": False}
                    )

    # Unsupported addons
    unsupported_dir = repo_root / ".unsupported"
    if unsupported_dir.exists():
        for item in sorted(unsupported_dir.iterdir()):
            if item.is_dir():
                config_path = item / "config.yaml"
                if config_path.exists():
                    addons.append(
                        {
                            "path": f".unsupported/{item.name}",
                            "config": config_path,
                            "unsupported": True,
                        }
                    )

    return addons


def generate_table(addons: list[dict]) -> str:
    """Generate the markdown table from addon info."""
    lines = [
        "| Name                                                            | Description                               | Status | Added   |",
        "| :-------------------------------------------------------------- | :---------------------------------------- | :----- | :------ |",
    ]

    for addon in addons:
        try:
            with open(addon["config"], "r", encoding="utf-8") as f:
                config = yaml.safe_load(f)

            name = config.get("name", addon["path"])
            description = config.get("description", "No description")[:45]
            version = str(config.get("version", "0.0.0"))

            status = get_status_emoji(version, addon["unsupported"])

            # Truncate description if needed
            if len(description) > 40:
                description = description[:37] + "..."

            # Add unsupported note if applicable
            if addon["unsupported"]:
                description = f"{description} (Unsupported)"

            # Added date placeholder - should be manually maintained in README.md
            added = "YYYY-MM"

            # Format with simple padding for readability in raw markdown,
            # though markdown renderers align tables automatically.
            link_md = f"[{name}]({addon['path']})"
            line = f"| **{link_md:<55}** | {description:<41} | {status}     | {added} |"
            lines.append(line)

        except Exception as e:
            print(f"Warning: Could not process {addon['path']}: {e}", file=sys.stderr)

    return "\n".join(lines)


def main():
    repo_root = Path(__file__).parent.parent

    addons = find_addons(repo_root)
    table = generate_table(addons)

    print("Generated table:")
    print(table)
    print("\nNOTE: The 'Added' column contains placeholders (YYYY-MM).")
    print("Please manually update the dates based on the existing README.md")
    print("or use the actual add-on creation dates for new add-ons.")

    # Note: This script only prints the table.
    # The workflow will handle the actual replacement.


if __name__ == "__main__":
    main()
