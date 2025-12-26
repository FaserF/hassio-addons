#!/usr/bin/env python3
"""
Prepare the edge branch for local development builds.

This script:
1. Removes 'image' tags from all addon config.yaml files
   (so Home Assistant builds them locally from Dockerfile)
2. Updates repository.json to indicate this is the edge channel
3. Adds edge-specific notes to READMEs

Usage:
    python3 prepare_edge_branch.py
"""

import json
import os
import re
import sys

import yaml


def remove_image_from_config(config_path: str) -> bool:
    """Remove the 'image' field from config.yaml to force local builds."""
    if not os.path.exists(config_path):
        return False

    try:
        with open(config_path, "r", encoding="utf-8") as f:
            content = f.read()

        # Check if image field exists
        if "image:" not in content:
            return False

        # Remove image line (handles both quoted and unquoted)
        new_content = re.sub(r"^image:.*$\n?", "", content, flags=re.MULTILINE)

        if new_content != content:
            with open(config_path, "w", encoding="utf-8") as f:
                f.write(new_content)
            return True

        return False
    except Exception as e:
        print(f"⚠️ Error processing {config_path}: {e}")
        return False


def add_edge_notice_to_readme(readme_path: str) -> bool:
    """Add edge branch notice to addon README."""
    if not os.path.exists(readme_path):
        return False

    edge_notice = """
> [!CAUTION]
> **EDGE/DEVELOPMENT BUILD**
>
> You are viewing the `edge` branch. This version is built locally from source
> and may contain bugs or incomplete features. For stable releases, switch to
> the `master` branch or use the stable repository URL.

"""

    try:
        with open(readme_path, "r", encoding="utf-8") as f:
            content = f.read()

        # Check if already has edge notice
        if "EDGE/DEVELOPMENT BUILD" in content:
            return False

        # Add after first heading
        lines = content.split("\n")
        insert_idx = 0
        for i, line in enumerate(lines):
            if line.startswith("# "):
                insert_idx = i + 1
                break

        lines.insert(insert_idx, edge_notice)

        with open(readme_path, "w", encoding="utf-8") as f:
            f.write("\n".join(lines))

        return True
    except Exception as e:
        print(f"⚠️ Error processing {readme_path}: {e}")
        return False


def update_repository_json() -> bool:
    """Update repository.json to indicate edge channel."""
    repo_json_path = "repository.json"

    if not os.path.exists(repo_json_path):
        return False

    try:

        with open(repo_json_path, "r", encoding="utf-8") as f:
            data = json.load(f)

        # Add edge indicator
        data["name"] = "FaserF's Home Assistant Add-ons (Edge)"

        # Initialize channels if missing
        if "channels" not in data:
            data["channels"] = {}

        # Set up edge channel, inheriting from stable if available
        base_channel = data.get("channels", {}).get(
            "stable", {"description": "Stable builds"}
        )
        data["channels"]["edge"] = base_channel.copy()
        data["channels"]["edge"]["name"] = "Edge"
        data["channels"]["edge"]["description"] = "Development/Edge builds"

        with open(repo_json_path, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2)
            f.write("\n")

        return True
    except Exception as e:
        print(f"⚠️ Error updating repository.json: {e}")
        return False


def main():
    print("🔧 Preparing edge branch for local builds...")

    # Find all addon directories
    addon_dirs = []

    for entry in os.listdir("."):
        if os.path.isdir(entry) and not entry.startswith("."):
            config_path = os.path.join(entry, "config.yaml")
            if os.path.exists(config_path):
                addon_dirs.append(entry)

    # Also check .unsupported
    unsupported_dir = ".unsupported"
    if os.path.isdir(unsupported_dir):
        for entry in os.listdir(unsupported_dir):
            entry_path = os.path.join(unsupported_dir, entry)
            if os.path.isdir(entry_path):
                config_path = os.path.join(entry_path, "config.yaml")
                if os.path.exists(config_path):
                    addon_dirs.append(entry_path)

    print(f"📦 Found {len(addon_dirs)} addons")

    # Process each addon
    images_removed = 0
    readmes_updated = 0

    for addon_dir in addon_dirs:
        config_path = os.path.join(addon_dir, "config.yaml")
        readme_path = os.path.join(addon_dir, "README.md")

        if remove_image_from_config(config_path):
            print(f"   ✅ Removed image from {addon_dir}")
            images_removed += 1

        if add_edge_notice_to_readme(readme_path):
            print(f"   📝 Added edge notice to {addon_dir}/README.md")
            readmes_updated += 1

    # Update main repository.json
    if update_repository_json():
        print("✅ Updated repository.json")

    # Update main README
    main_readme = "README.MD"
    if add_edge_notice_to_readme(main_readme):
        print("📝 Added edge notice to main README.MD")

    print("\n✅ Edge preparation complete!")
    print(f"   📦 Images removed: {images_removed}")
    print(f"   📝 READMEs updated: {readmes_updated}")


if __name__ == "__main__":
    main()
