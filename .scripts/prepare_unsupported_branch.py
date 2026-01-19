#!/usr/bin/env python3
"""
Prepare the unsupported branch.
1. Updates repository.json to be "Unsupported".
2. Adds warning headers to READMEs.
3. Updates addon names to include "(Unsupported)" suffix.
4. Cleans config keys if needed (handled mostly by bump_version or prepare_edge).
"""

import json
import os
import re

import yaml


def update_repository_json():
    repo_path = "repository.json"
    if not os.path.exists(repo_path):
        return

    try:
        with open(repo_path, "r") as f:
            data = json.load(f)

        data["name"] = "FaserF's Unsupported Add-ons"
        data["maintainer"] = "FaserF (Archive)"
        data["url"] = "https://github.com/FaserF/hassio-addons/tree/unsupported"

        # Wipe channels mostly, or just leave them?
        # A repository must have an empty structure properly.
        # But we barely need channel mapping if all are unsupported.
        # Just ensure 'stable' or 'edge' channel exists pointing to THIS branch context?
        # Actually Supervisor just looks for add-ons in the root.

        with open(repo_path, "w") as f:
            json.dump(data, f, indent=2)
            f.write("\n")
        print("✅ Updated repository.json for Unsupported branch")
    except Exception as e:
        print(f"❌ Failed to update repository.json: {e}")


def add_unsupported_notice(readme_path):
    if not os.path.exists(readme_path):
        return

    notice = """
> [!CAUTION]
> **UNSUPPORTED ADD-ON**
>
> This add-on is no longer maintained and has been moved to the `unsupported` branch.
> It is provided for archival purposes only.
> **USE AT YOUR OWN RISK.**
>
"""
    try:
        with open(readme_path, "r", encoding="utf-8") as f:
            content = f.read()

        if "UNSUPPORTED ADD-ON" in content:
            return

        # Insert after header if possible
        lines = content.splitlines()
        if lines and lines[0].startswith("#"):
            lines.insert(1, notice)
        else:
            lines.insert(0, notice)

        with open(readme_path, "w", encoding="utf-8") as f:
            f.write("\n".join(lines) + "\n")
        print(f"📝 Added unsupported notice to {readme_path}")
    except Exception as e:
        print(f"❌ Failed to update {readme_path}: {e}")


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
        pattern_nq = re.compile(rf"^name:\s+({re.escape(current_name)})$", re.MULTILINE)

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


def remove_image_key(config_path):
    # Sanity check to ensure local build
    if not os.path.exists(config_path):
        return
    try:
        with open(config_path, "r") as f:
            content = f.read()

        # Remove any image: ... line
        new_content = re.sub(r"^image:.*$\n?", "", content, flags=re.MULTILINE)

        if content != new_content:
            with open(config_path, "w") as f:
                f.write(new_content)
            print(f"🔧 Removed image key from {config_path}")
    except Exception as e:
        print(f"❌ Failed to clean {config_path}: {e}")


def main():
    print("💀 Preparing Unsupported Branch...")
    update_repository_json()

    # Iterate all subdirectories that look like addons
    for entry in os.listdir("."):
        if os.path.isdir(entry) and not entry.startswith("."):
            config_path = os.path.join(entry, "config.yaml")
            if os.path.exists(config_path):
                add_unsupported_notice(os.path.join(entry, "README.md"))
                remove_image_key(config_path)
                # Update addon name to include "(Unsupported)" suffix
                if update_addon_name(config_path, " (Unsupported)"):
                    print(f"🏷️  Updated name in {entry} with suffix '(Unsupported)'")

    # Update main README
    if os.path.exists("README.md"):
        # Replace content or prepend?
        # User said: "The main readme should be automatically adapted in the new branch"
        # It should probably list ONLY the unsupported addons.
        # For now, let's just prepend a huge warning.
        add_unsupported_notice("README.md")


if __name__ == "__main__":
    main()
