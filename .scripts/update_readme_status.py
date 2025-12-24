#!/usr/bin/env python3
"""
Script to update README.md with Beta status indicators.

Reads all addon config.yaml files, checks if version contains 'b' or 'beta',
and updates the README table Status column accordingly.

✅ = Stable
⚠️ = Beta (functional but in development)
"""

import os
import re
import yaml

def get_addon_status(addon_path):
    """Determine if an addon is Beta based on version string."""
    config_path = os.path.join(addon_path, "config.yaml")
    if not os.path.exists(config_path):
        return None

    try:
        with open(config_path, "r", encoding="utf-8") as f:
            config = yaml.safe_load(f)

        version = str(config.get("version", ""))
        name = config.get("name", os.path.basename(addon_path))

        # Check if version contains beta indicators
        is_beta = bool(re.search(r'(b\d*|beta|alpha|rc|dev)', version.lower()))

        return {
            "name": name,
            "path": os.path.basename(addon_path),
            "version": version,
            "is_beta": is_beta,
            "status": "⚠️" if is_beta else "✅"
        }
    except Exception as e:
        print(f"Error reading {config_path}: {e}")
        return None

def update_readme():
    """Update README.md with correct Beta status indicators."""
    readme_path = "README.MD"

    # Get all addon statuses
    addons = {}
    for item in os.listdir("."):
        if os.path.isdir(item) and not item.startswith("."):
            status = get_addon_status(item)
            if status:
                addons[status["path"]] = status

    # Read README
    with open(readme_path, "r", encoding="utf-8") as f:
        content = f.read()

    # Find and update the table
    # Pattern matches lines like: | **[Name](path)** | Description | ✅ |
    table_pattern = r'\| \*\*\[([^\]]+)\]\(([^)]+)\)\*\* \| ([^|]+) \| (✅|⚠️) \|'

    def replace_status(match):
        name = match.group(1)
        path = match.group(2)
        desc = match.group(3)
        current_status = match.group(4)

        # Look up the addon status
        if path in addons:
            new_status = addons[path]["status"]
            if new_status != current_status:
                print(f"📝 Updating {name}: {current_status} → {new_status}")
        else:
            new_status = current_status

        return f'| **[{name}]({path})** | {desc} | {new_status} |'

    new_content = re.sub(table_pattern, replace_status, content)

    # Check if legend exists, if not add it
    legend = """
> **Legend:**
> - ✅ = Stable
> - ⚠️ = Beta (functional but still in development)
"""

    # Insert legend after the table (after markdownlint-enable)
    if "**Legend:**" not in new_content:
        new_content = new_content.replace(
            "<!-- markdownlint-enable MD060 -->",
            "<!-- markdownlint-enable MD060 -->\n" + legend.strip()
        )
        print("📝 Added legend to README")

    # Write back if changed
    if new_content != content:
        with open(readme_path, "w", encoding="utf-8") as f:
            f.write(new_content)
        print("✅ README updated with Beta status")
    else:
        print("✨ README already up to date")

if __name__ == "__main__":
    update_readme()
