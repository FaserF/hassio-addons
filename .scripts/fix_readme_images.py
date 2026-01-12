#!/usr/bin/env python3
"""
Fix relative image paths in README files for Home Assistant Add-on UI compatibility.

The Home Assistant Supervisor UI cannot render relative image paths like `![Logo](logo.png)`.
This script converts them to absolute GitHub raw URLs.

Usage:
    python fix_readme_images.py [--dry-run]
"""

import os
import re
import argparse
from pathlib import Path


def get_repo_info():
    """Get repository owner/name from git remote."""
    import subprocess
    try:
        result = subprocess.run(
            ["git", "config", "--get", "remote.origin.url"],
            capture_output=True, text=True, check=True
        )
        url = result.stdout.strip()
        # Handle both HTTPS and SSH URLs
        match = re.search(r"github\.com[:/]([^/]+)/([^/.]+)", url)
        if match:
            return match.group(1), match.group(2).replace(".git", "")
    except Exception:
        pass
    return "FaserF", "hassio-addons"  # Fallback


def get_default_branch():
    """Get the default branch name."""
    import subprocess
    try:
        result = subprocess.run(
            ["git", "symbolic-ref", "refs/remotes/origin/HEAD"],
            capture_output=True, text=True, check=True
        )
        return result.stdout.strip().split("/")[-1]
    except Exception:
        return "master"  # Fallback


def fix_readme_images(addon_path: Path, owner: str, repo: str, branch: str, dry_run: bool = False):
    """Fix relative image paths in a README file."""
    readme_path = addon_path / "README.md"
    if not readme_path.exists():
        return False, "No README.md found"

    content = readme_path.read_text(encoding="utf-8")
    original_content = content

    # Pattern to match relative image references: ![alt](filename.ext)
    # Excludes URLs (http/https) and absolute paths
    pattern = r'!\[([^\]]*)\]\((?!https?://|/)([^)]+\.(png|jpg|jpeg|gif|svg|webp))\)'

    addon_name = addon_path.name

    def replace_image(match):
        alt_text = match.group(1)
        filename = match.group(2)
        # Build absolute raw GitHub URL
        raw_url = f"https://raw.githubusercontent.com/{owner}/{repo}/{branch}/{addon_name}/{filename}"
        return f"![{alt_text}]({raw_url})"

    content = re.sub(pattern, replace_image, content, flags=re.IGNORECASE)

    if content != original_content:
        if not dry_run:
            readme_path.write_text(content, encoding="utf-8")
        return True, "Fixed image paths"

    return False, "No changes needed"


def main():
    parser = argparse.ArgumentParser(description="Fix relative image paths in README files")
    parser.add_argument("--dry-run", action="store_true", help="Show what would be changed without making changes")
    args = parser.parse_args()

    # Get repo info
    owner, repo = get_repo_info()
    branch = get_default_branch()

    print(f"Repository: {owner}/{repo} (branch: {branch})")
    print(f"Mode: {'DRY RUN' if args.dry_run else 'APPLYING CHANGES'}")
    print("-" * 50)

    # Find all addon directories (directories with config.yaml)
    root = Path(".")
    fixed_count = 0

    for config_file in root.glob("*/config.yaml"):
        addon_path = config_file.parent

        # Skip hidden directories
        if addon_path.name.startswith("."):
            continue

        changed, message = fix_readme_images(addon_path, owner, repo, branch, args.dry_run)

        if changed:
            print(f"✅ {addon_path.name}: {message}")
            fixed_count += 1
        else:
            print(f"⏭️  {addon_path.name}: {message}")

    print("-" * 50)
    print(f"Total: {fixed_count} README(s) {'would be ' if args.dry_run else ''}updated")


if __name__ == "__main__":
    main()
