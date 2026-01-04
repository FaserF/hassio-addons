#!/usr/bin/env python3
"""
Trigger release workflow for all add-ons in the repository.

This script finds all add-ons (both supported and unsupported) and triggers
the orchestrator-release workflow for each one. Useful for bulk releases when
versions are already correct but releases need to be generated.

Usage:
    python3 .scripts/trigger_all_releases.py
"""

import os
import subprocess
import sys
import time

# Add-ons to skip (e.g., test add-ons or ones that shouldn't be released)
SKIP_ADDONS = {
    "homeassistant-test-instance",  # Test add-on, skip releases
}


def get_all_addons():
    """Find all add-ons in the repository."""
    addons = []
    repo_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

    # Regular addons (top-level directories with config.yaml)
    for item in sorted(os.listdir(repo_root)):
        item_path = os.path.join(repo_root, item)
        if (
            os.path.isdir(item_path)
            and not item.startswith(".")
            and not item.startswith("_")
            and os.path.exists(os.path.join(item_path, "config.yaml"))
        ):
            if item not in SKIP_ADDONS:
                addons.append(item)

    # Unsupported addons
    unsupported_dir = os.path.join(repo_root, ".unsupported")
    if os.path.exists(unsupported_dir):
        for item in sorted(os.listdir(unsupported_dir)):
            item_path = os.path.join(unsupported_dir, item)
            if os.path.isdir(item_path) and os.path.exists(
                os.path.join(item_path, "config.yaml")
            ):
                addon_path = f".unsupported/{item}"
                if item not in SKIP_ADDONS:
                    addons.append(addon_path)

    return sorted(addons)


def trigger_release(addon, version="patch", delay=2):
    """Trigger release workflow for a single add-on."""
    print(f"🚀 Triggering release for: {addon}")
    try:
        subprocess.run(
            [
                "gh",
                "workflow",
                "run",
                "orchestrator-release.yaml",
                "-f",
                f"addon={addon}",
                "-f",
                f"version={version}",
            ],
            check=True,
            capture_output=True,
            text=True,
        )
        print(f"  ✅ Successfully triggered {addon}")
        if delay > 0:
            time.sleep(delay)  # Small delay to avoid rate limiting
        return True
    except subprocess.CalledProcessError as e:
        print(f"  ❌ Failed to trigger {addon}: {e.stderr}")
        return False
    except FileNotFoundError:
        print("  ❌ Error: 'gh' CLI tool not found. Please install GitHub CLI.")
        return False


def main():
    """Main function."""
    addons = get_all_addons()

    if not addons:
        print("ℹ️  No add-ons found.")
        return

    print(f"📦 Found {len(addons)} add-on(s) to release:")
    for addon in addons:
        print(f"  - {addon}")

    print("\n⚠️  This will trigger releases for ALL add-ons.")
    response = input("Continue? (yes/no): ").strip().lower()

    if response not in ("yes", "y"):
        print("❌ Aborted.")
        sys.exit(1)

    print(f"\n🚀 Triggering releases for {len(addons)} add-on(s)...\n")

    success_count = 0
    failed_addons = []

    for addon in addons:
        if trigger_release(addon):
            success_count += 1
        else:
            failed_addons.append(addon)

    print(f"\n📊 Summary:")
    print(f"  ✅ Successfully triggered: {success_count}/{len(addons)}")
    if failed_addons:
        print(f"  ❌ Failed: {len(failed_addons)}")
        for addon in failed_addons:
            print(f"     - {addon}")


if __name__ == "__main__":
    main()
