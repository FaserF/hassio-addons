#!/usr/bin/env python3
"""
Script to update README.md with correct status indicators.

Reads all addon config.yaml files, checks version status, and updates
the README table Status column accordingly.

Legend:
- ✅ = Stable (version >= 1.0.0)
- ⚠️ = Beta (version < 1.0.0, functional but in development)
- ❌ = Unsupported (in .unsupported/ folder)

Expected Table Format:
| **[Name](path)** | Description | ✅ |
"""

import os
import re

try:
    import yaml
except ImportError:
    print("⚠️ PyYAML not installed. Install with: pip install pyyaml")
    import sys

    sys.exit(1)

# Directories to exclude from scanning
EXCLUDED_DIRS = {"__pycache__", "node_modules", ".git", ".github", ".scripts"}


def is_prerelease_version(version_str):
    """
    Determine if a version string represents a pre-release.

    Pre-release criteria:
    1. Version < 1.0.0 (e.g., 0.9.0)
    2. Contains pre-release identifiers (alpha, beta, rc, dev, etc.)
    """
    version = str(version_str).lower().strip()

    # Check for pre-release identifiers
    prerelease_pattern = r"(a\d*|alpha|b\d*|beta|rc\d*|dev|preview|snapshot)"
    if re.search(prerelease_pattern, version):
        return True

    # Try to parse semantic version and check if < 1.0.0
    semver_match = re.match(r"^(\d+)\.(\d+)\.?(\d+)?", version)
    if semver_match:
        major = int(semver_match.group(1))
        if major < 1:
            return True

    return False


def get_addon_status(addon_path, is_unsupported=False):
    """Determine addon status based on version string and location."""
    config_path = os.path.join(addon_path, "config.yaml")
    if not os.path.exists(config_path):
        return None

    try:
        with open(config_path, "r", encoding="utf-8") as f:
            config = yaml.safe_load(f)
    except FileNotFoundError:
        print(f"Config file not found: {config_path}")
        return None
    except yaml.YAMLError as e:
        print(f"YAML parse error in {config_path}: {e}")
        return None

    if config is None:
        return None

    version = str(config.get("version", ""))
    name = config.get("name", os.path.basename(addon_path))

    # Determine status
    if is_unsupported:
        status = "❌"
        status_name = "Unsupported"
    elif is_prerelease_version(version):
        status = "⚠️"
        status_name = "Beta"
    else:
        status = "✅"
        status_name = "Stable"

    return {
        "name": name,
        "path": os.path.basename(addon_path),
        "version": version,
        "status": status,
        "status_name": status_name,
    }


def update_readme():
    """Update README.md with correct status indicators."""
    # Try both case variants for cross-platform compatibility
    readme_path = None
    for candidate in ["README.md", "README.MD"]:
        if os.path.exists(candidate):
            readme_path = candidate
            break

    # Check if README exists
    if readme_path is None:
        print("⚠️ README not found (tried README.md and README.MD)")
        return

    # Get all addon statuses
    addons = {}

    # Scan root directories
    for item in os.listdir("."):
        if item.startswith(".") or item in EXCLUDED_DIRS:
            continue
        if os.path.isdir(item):
            status = get_addon_status(item, is_unsupported=False)
            if status:
                addons[item] = status

    # Scan .unsupported directory
    unsupported_dir = ".unsupported"
    if os.path.exists(unsupported_dir):
        for item in os.listdir(unsupported_dir):
            item_path = os.path.join(unsupported_dir, item)
            if os.path.isdir(item_path):
                status = get_addon_status(item_path, is_unsupported=True)
                if status:
                    # Use full path for unsupported addons
                    addons[f".unsupported/{item}"] = status

    # Read README
    try:
        with open(readme_path, "r", encoding="utf-8") as f:
            content = f.read()
    except IOError as e:
        print(f"⚠️ Failed to read README: {e}")
        return

    # Find and update the table
    # Pattern matches lines like: | **[Name](path)** | Description | ✅ |
    table_pattern = r"\| \*\*\[([^\]]+)\]\(([^)]+)\)\*\* \| ([^|]+) \| (✅|⚠️|❌) \|"

    matches_found = 0
    updates_made = 0

    def replace_status(match):
        nonlocal matches_found, updates_made
        matches_found += 1
        name = match.group(1)
        path = match.group(2)
        desc = match.group(3)
        current_status = match.group(4)

        # Look up the addon status
        if path in addons:
            new_status = addons[path]["status"]
            if new_status != current_status:
                print(
                    f"📝 Updating {name}: {current_status} → {new_status} ({addons[path]['status_name']})"
                )
                updates_made += 1
        else:
            new_status = current_status

        return f"| **[{name}]({path})** | {desc} | {new_status} |"

    new_content = re.sub(table_pattern, replace_status, content)

    # Log summary
    if matches_found == 0:
        print("⚠️ No table rows matched. Check if table format has changed.")
    else:
        print(f"ℹ️ Scanned {matches_found} rows, {updates_made} updates needed.")

    # Print beta addons detected
    print("\n📊 Status Summary:")
    for path, info in sorted(addons.items()):
        print(f"  {info['status']} {info['name']} (v{info['version']})")

    # Write back if changed
    if new_content != content:
        try:
            with open(readme_path, "w", encoding="utf-8") as f:
                f.write(new_content)
            print("\n✅ README updated with status changes")
        except IOError as e:
            print(f"⚠️ Failed to write README: {e}")
    else:
        print("\n✨ README already up to date")


if __name__ == "__main__":
    update_readme()
