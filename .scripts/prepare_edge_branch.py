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

        # Check if image field exists (including commented out ones)
        if "image:" not in content:
            return False

        # Remove image line (handles both quoted and unquoted)
        # Also handle commented out images
        # Pattern matches: "image: ..." or "# image: ..." at start of line (with optional whitespace)
        # First remove uncommented image lines
        new_content = re.sub(r"^(\s*)image:.*$\n?", "", content, flags=re.MULTILINE)
        # Then remove commented out image lines
        new_content = re.sub(
            r"^(\s*)#\s*image:.*$\n?", "", new_content, flags=re.MULTILINE
        )

        if new_content != content:
            with open(config_path, "w", encoding="utf-8") as f:
                f.write(new_content)
            return True

        return False
    except (OSError, ValueError) as e:
        print(f"⚠️ Error processing {config_path}: {e}")
        return False


def update_addon_name(config_path: str, suffix: str) -> bool:
    """
    Append suffix to the 'name' field in config.yaml.
    Handles both quoted and unquoted name values.
    """
    if not os.path.exists(config_path):
        return False

    try:
        with open(config_path, "r", encoding="utf-8") as f:
            content = f.read()

        data = yaml.safe_load(content)
        if not data or "name" not in data:
            return False

        current_name = data["name"]

        # Avoid double suffixing
        if current_name.endswith(suffix):
            return False

        new_name = f"{current_name}{suffix}"

        # Try multiple patterns to handle different quote styles
        # Pattern 1: name: "Value" (double quotes)
        pattern_dq = re.compile(
            rf'^name:\s+"({re.escape(current_name)})"$', re.MULTILINE
        )
        # Pattern 2: name: 'Value' (single quotes)
        pattern_sq = re.compile(
            rf"^name:\s+'({re.escape(current_name)})'$", re.MULTILINE
        )
        # Pattern 3: name: Value (no quotes)
        pattern_nq = re.compile(rf"^name:\s+({re.escape(current_name)})\s*$", re.MULTILINE)

        new_content = content
        updated = False

        if pattern_dq.search(content):
            new_content = pattern_dq.sub(f'name: "{new_name}"', content)
            updated = True
        elif pattern_sq.search(content):
            new_content = pattern_sq.sub(f"name: '{new_name}'", content)
            updated = True
        elif pattern_nq.search(content):
            new_content = pattern_nq.sub(f"name: {new_name}", content)
            updated = True

        if updated:
            with open(config_path, "w", encoding="utf-8") as f:
                f.write(new_content)
            return True

        return False

    except Exception as e:
        print(f"⚠️ Error updating name in {config_path}: {e}")
        return False


def remap_ports_in_config(config_path: str) -> bool:
    """
    Remap default ports in config.yaml for Edge/Dev builds.
    Adds 10000 to the host port number to avoid conflicts with stable addons.
    """
    if not os.path.exists(config_path):
        return False

    try:
        with open(config_path, "r", encoding="utf-8") as f:
            content = f.read()

        data = yaml.safe_load(content)
        if not data or "ports" not in data or not isinstance(data["ports"], dict):
            return False

        new_content = content
        changes_made = False

        ports_section = data["ports"]
        for port_key, host_port in ports_section.items():
            if host_port is None:
                continue

            original_port = int(host_port)
            new_port = original_port + 10000

            # Construct regex to find this specific line
            pattern = re.compile(
                rf"^(\s+){re.escape(str(port_key))}:\s+{original_port}$", re.MULTILINE
            )

            if pattern.search(new_content):
                new_content = pattern.sub(rf"\g<1>{port_key}: {new_port}", new_content)
                changes_made = True

        if changes_made:
            with open(config_path, "w", encoding="utf-8") as f:
                f.write(new_content)
            return True

        return False

    except Exception as e:
        print(f"⚠️ Error remapping ports in {config_path}: {e}")
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
        return True
    except (OSError, ValueError) as e:
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
        return True
    except (OSError, ValueError, json.JSONDecodeError) as e:
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

        if remap_ports_in_config(config_path):
            print(f"   ✅ Remapped ports in {addon_dir}")

        # Determine suffix based on directory
        suffix = " (Unsupported)" if ".unsupported" in addon_dir else " (Edge)"
        if update_addon_name(config_path, suffix):
            print(f"   🏷️  Updated name in {addon_dir} with suffix '{suffix}'")

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
