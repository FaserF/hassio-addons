#!/usr/bin/env python3
"""
Ensure all add-ons have an 'image' field in their config.yaml.

This script:
- Finds all add-ons (excluding .unsupported)
- Checks if they have an 'image' field
- Adds missing 'image' fields based on the slug
- Skips if running on edge/unsupported branch

Usage:
    python3 .scripts/ensure_image_fields.py [--dry-run]
"""

import argparse
import os
import re
import subprocess
import sys

import yaml

# Image naming convention
IMAGE_TEMPLATE = "ghcr.io/faserf/{slug}-{{arch}}"


def get_current_branch():
    """Get the current git branch."""
    try:
        result = subprocess.run(
            ["git", "rev-parse", "--abbrev-ref", "HEAD"],
            capture_output=True,
            text=True,
            check=True,
        )
        return result.stdout.strip()
    except (subprocess.CalledProcessError, FileNotFoundError):
        return None


def should_skip_branch(branch):
    """Check if we should skip processing based on branch."""
    skip_branches = ["edge", "unsupported"]
    if branch:
        branch_lower = branch.lower()
        for skip in skip_branches:
            if skip in branch_lower:
                return True
    return False


def find_addons(repo_root):
    """Find all add-ons in the repository (excluding .unsupported)."""
    addons = []

    # Regular addons (top-level directories with config.yaml)
    for item in sorted(os.listdir(repo_root)):
        item_path = os.path.join(repo_root, item)
        if (
            os.path.isdir(item_path)
            and not item.startswith(".")
            and not item.startswith("_")
            and os.path.exists(os.path.join(item_path, "config.yaml"))
        ):
            addons.append(item_path)

    return sorted(addons)


def get_slug_from_config(config_path):
    """Extract slug from config.yaml."""
    try:
        with open(config_path, "r", encoding="utf-8") as f:
            config = yaml.safe_load(f)
            return config.get("slug") or os.path.basename(
                os.path.dirname(config_path)
            )
    except Exception as e:
        print(f"⚠️  Error reading {config_path}: {e}")
        return os.path.basename(os.path.dirname(config_path))


def normalize_slug_for_image(slug):
    """Normalize slug for use in image name."""
    # Convert to lowercase and replace underscores with hyphens
    normalized = slug.lower().replace("_", "-")
    return normalized


def add_image_field(config_path, slug, dry_run=False):
    """Add or update image field in config.yaml."""
    try:
        with open(config_path, "r", encoding="utf-8") as f:
            content = f.read()

        # Generate correct image name
        normalized_slug = normalize_slug_for_image(slug)
        correct_image_value = IMAGE_TEMPLATE.format(slug=normalized_slug)

        # Check if image field already exists
        image_match = re.search(r"^image:\s*(.+)$", content, re.MULTILINE)
        if image_match:
            existing_image = image_match.group(1).strip().strip('"').strip("'")
            # Check if it needs updating (old format with hassio-addons- prefix)
            if "hassio-addons-" in existing_image or existing_image != correct_image_value:
                # Update existing image field
                new_content = re.sub(
                    r"^image:\s*.+$",
                    f"image: {correct_image_value}",
                    content,
                    flags=re.MULTILINE
                )
                if new_content != content:
                    if not dry_run:
                        with open(config_path, "w", encoding="utf-8") as f:
                            f.write(new_content)
                    return True, f"Updated from '{existing_image}' to '{correct_image_value}'"
                return False, "Image field already correct"
            return False, "Image field already correct"

        # Load YAML to find insertion point
        config = yaml.safe_load(content)
        if not config:
            return False, "Could not parse config.yaml"

        # Generate image name
        normalized_slug = normalize_slug_for_image(slug)
        image_value = IMAGE_TEMPLATE.format(slug=normalized_slug)

        # Find where to insert (after slug or version)
        lines = content.split("\n")
        insert_index = None

        for i, line in enumerate(lines):
            # Insert after slug line
            if re.match(r"^\s*slug:\s*", line):
                insert_index = i + 1
                break
            # Or after version if slug not found
            elif re.match(r"^\s*version:\s*", line) and insert_index is None:
                insert_index = i + 1

        if insert_index is None:
            # Insert after first non-comment line
            for i, line in enumerate(lines):
                if line.strip() and not line.strip().startswith("#"):
                    insert_index = i + 1
                    break

        if insert_index is None:
            insert_index = 1

        # Insert image line with proper indentation
        # Determine indentation from previous line
        if insert_index > 0:
            prev_line = lines[insert_index - 1]
            indent = len(prev_line) - len(prev_line.lstrip())
            image_line = " " * indent + f"image: {image_value}"
        else:
            image_line = f"image: {image_value}"

        # Insert the line
        lines.insert(insert_index, image_line)
        new_content = "\n".join(lines)

        if not dry_run:
            with open(config_path, "w", encoding="utf-8") as f:
                f.write(new_content)

        return True, image_value

    except Exception as e:
        return False, f"Error: {e}"


def main():
    """Main function."""
    parser = argparse.ArgumentParser(
        description="Ensure all add-ons have an 'image' field"
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Show what would be changed without making changes",
    )
    args = parser.parse_args()

    # Check branch
    branch = get_current_branch()
    if should_skip_branch(branch):
        print(f"⏭️  Skipping: Running on branch '{branch}' (edge/unsupported branch)")
        print("   Image fields should not be present in edge/unsupported branches")
        sys.exit(0)

    if branch:
        print(f"📍 Current branch: {branch}")

    repo_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    os.chdir(repo_root)

    addons = find_addons(repo_root)

    if not addons:
        print("ℹ️  No add-ons found.")
        return

    print(f"📦 Checking {len(addons)} add-on(s)...\n")

    updated = []
    skipped = []
    errors = []

    for addon_path in addons:
        addon_name = os.path.basename(addon_path)
        config_path = os.path.join(addon_path, "config.yaml")

        slug = get_slug_from_config(config_path)
        success, message = add_image_field(config_path, slug, dry_run=args.dry_run)

        if success and "already correct" not in message:
            updated.append((addon_name, message))
            if "Updated" in message:
                action = "Would update" if args.dry_run else "✅ Updated"
            else:
                action = "Would add" if args.dry_run else "✅ Added"
            print(f"{action} image field in {addon_name}: {message}")
        elif "already correct" in message:
            skipped.append(addon_name)
        else:
            errors.append((addon_name, message))
            print(f"❌ Error processing {addon_name}: {message}")

    print(f"\n📊 Summary:")
    print(f"  ✅ {'Would update' if args.dry_run else 'Updated'}: {len(updated)}")
    print(f"  ⏭️  Skipped (already has image): {len(skipped)}")
    if errors:
        print(f"  ❌ Errors: {len(errors)}")

    if args.dry_run and updated:
        print("\n💡 Run without --dry-run to apply changes")


if __name__ == "__main__":
    main()
