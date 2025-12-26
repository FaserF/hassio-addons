#!/usr/bin/env python3
"""
Bump add-on version with auto-generated changelog.

Features:
- Clickable commit hashes linking to GitHub
- Clickable version references for dependencies
- Dev version suffix support (1.2.3-dev)
- Categorized changelog entries from git history
"""

import argparse
import os
import re
import subprocess
import sys
from datetime import datetime

# GitHub repository for commit links
GITHUB_REPO = "https://github.com/FaserF/hassio-addons"

# Known dependency release URLs
DEPENDENCY_URLS = {
    "ghcr.io/hassio-addons/base": "https://github.com/hassio-addons/addon-base/releases/tag",
    "ghcr.io/hassio-addons/debian-base": "https://github.com/hassio-addons/addon-debian-base/releases/tag",
    "ghcr.io/home-assistant/home-assistant": "https://github.com/home-assistant/core/releases/tag",
    "42wim/matterbridge": "https://github.com/42wim/matterbridge/releases/tag",
    "pterodactyl/wings": "https://github.com/pterodactyl/wings/releases/tag",
    "pterodactyl/panel": "https://github.com/pterodactyl/panel/releases/tag",
    "requarks/wiki": "https://github.com/requarks/wiki/releases/tag",
    "netbootxyz/webapp": "https://github.com/netbootxyz/webapp/releases/tag",
}


def get_git_remote_url():
    """Get the GitHub repo URL from git remote."""
    try:
        result = subprocess.run(
            ["git", "remote", "get-url", "origin"],
            capture_output=True,
            text=True,
        )
        if result.returncode == 0:
            url = result.stdout.strip()
            # Convert SSH to HTTPS
            if url.startswith("git@github.com:"):
                url = url.replace("git@github.com:", "https://github.com/")
            if url.endswith(".git"):
                url = url[:-4]
            return url
    except Exception:
        pass
    return GITHUB_REPO


def get_git_log_for_addon(addon_path, since_tag=None):
    """Get git commit log with full hash for the addon."""
    try:
        addon_name = os.path.basename(addon_path.rstrip("/\\"))

        if since_tag:
            tag = since_tag
        else:
            result = subprocess.run(
                ["git", "tag", "--sort=-creatordate"],
                capture_output=True,
                text=True,
                cwd=os.path.dirname(addon_path) or ".",
            )
            tags = result.stdout.strip().split("\n")
            addon_tags = [
                t for t in tags if f"{addon_name}-v" in t or t.startswith("v") or t == f"v{addon_name}"
            ]
            # If no tags found specific to this addon, fallback to broader search but warn?
            # Actually, standard pattern is usually just vX.Y.Z for single addon, or addon-vX.Y.Z for monorepo.
            # The original code was `addon_name in t.lower() or t.startswith("v")`.
            # I will change it to `t.startswith(f"{addon_name}-v") or (t.startswith("v") and "-" not in t)`
            # This avoids matching "other-addon-v1.0.0" when looking for "addon".

            addon_tags = [
               t for t in tags
               if t == f"v{addon_name}"
               or t.startswith(f"{addon_name}-")
               or (t.startswith("v") and len(t.split("-")) == 1) # simple v1.2.3
            ]
            tag = addon_tags[0] if addon_tags else None

        # Get full hash for commit links
        if tag:
            cmd = [
                "git",
                "log",
                f"{tag}..HEAD",
                "--pretty=format:%s|%H|%h",
                "--",
                addon_path,
            ]
        else:
            cmd = ["git", "log", "-20", "--pretty=format:%s|%H|%h", "--", addon_path]

        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            cwd=os.path.dirname(addon_path) or ".",
        )

        if result.returncode == 0 and result.stdout.strip():
            commits = []
            for line in result.stdout.strip().split("\n"):
                parts = line.split("|")
                if len(parts) >= 3:
                    commits.append(
                        {
                            "message": parts[0],
                            "full_hash": parts[1],
                            "short_hash": parts[2],
                        }
                    )
            return commits

        return []
    except Exception as e:
        print(f"⚠️ Could not get git log: {e}")
        return []


def make_version_link(text, version):
    """Make version numbers clickable if a matching dependency is found."""
    for dep_name, base_url in DEPENDENCY_URLS.items():
        if dep_name.lower() in text.lower():
            return f"[{version}]({base_url}/{version})"
    return version


def categorize_commits(commits, repo_url):
    """Categorize commits with clickable links."""
    categories = {
        "✨ Features": [],
        "🐛 Bug Fixes": [],
        "📦 Dependencies": [],
        "🔧 Configuration": [],
        "📝 Documentation": [],
        "🎨 Style": [],
        "♻️ Refactor": [],
        "🔒 Security": [],
        "🚀 Other": [],
    }

    for commit in commits:
        msg = commit["message"]
        msg_lower = msg.lower()
        full_hash = commit["full_hash"]
        short_hash = commit["short_hash"]

        # Skip merge commits and CI commits
        if msg_lower.startswith("merge ") or "[skip ci]" in msg_lower:
            continue

        # Create clickable commit reference
        commit_link = f"[`{short_hash}`]({repo_url}/commit/{full_hash})"

        # Clean up message (remove conventional commit prefix)
        clean_msg = re.sub(
            r"^(feat|fix|docs|style|refactor|test|chore|deps?|config)(\([^)]+\))?:\s*",
            "",
            msg,
            flags=re.IGNORECASE,
        )

        # Make version references clickable
        version_match = re.search(r"(\d+\.\d+\.\d+)", clean_msg)
        if version_match:
            version = version_match.group(1)
            version_link = make_version_link(clean_msg, version)
            if version_link != version:
                clean_msg = clean_msg.replace(version, version_link)

        entry = f"{clean_msg} ({commit_link})"

        # Categorize
        if any(prefix in msg_lower for prefix in ["feat:", "feat(", "add:", "new:"]):
            categories["✨ Features"].append(entry)
        elif any(prefix in msg_lower for prefix in ["fix:", "fix(", "bug:", "bugfix:"]):
            categories["🐛 Bug Fixes"].append(entry)
        elif any(
            prefix in msg_lower
            for prefix in [
                "deps:",
                "dep:",
                "⬆️",
                "bump",
                "renovate",
                "dependency",
                "update",
            ]
        ):
            categories["📦 Dependencies"].append(entry)
        elif any(prefix in msg_lower for prefix in ["config:", "conf:", "chore:"]):
            categories["🔧 Configuration"].append(entry)
        elif any(prefix in msg_lower for prefix in ["docs:", "doc:", "readme"]):
            categories["📝 Documentation"].append(entry)
        elif any(prefix in msg_lower for prefix in ["style:", "format:", "lint:"]):
            categories["🎨 Style"].append(entry)
        elif any(prefix in msg_lower for prefix in ["refactor:", "refact:", "clean:"]):
            categories["♻️ Refactor"].append(entry)
        elif any(prefix in msg_lower for prefix in ["security:", "sec:", "vuln:"]):
            categories["🔒 Security"].append(entry)
        else:
            categories["🚀 Other"].append(entry)

    return categories


def generate_changelog_entry(version, addon_path, changelog_message=None):
    """Generate a detailed changelog entry with clickable links."""
    entry_date = datetime.now().strftime("%Y-%m-%d")
    entry = f"## {version} ({entry_date})\n\n"

    repo_url = get_git_remote_url()
    commits = get_git_log_for_addon(addon_path)

    if commits:
        categories = categorize_commits(commits, repo_url)

        for category, items in categories.items():
            if items:
                entry += f"### {category}\n"
                for item in items[:10]:
                    entry += f"- {item}\n"
                entry += "\n"

        if changelog_message and changelog_message not in [
            "Manual Release via Orchestrator",
            "Automatic release after dependency update",
        ]:
            entry += f"### 📌 Release Note\n- {changelog_message}\n\n"
    else:
        if changelog_message:
            entry += f"- {changelog_message}\n\n"
        else:
            entry += f"- Bump version to {version}\n\n"

    return entry


def parse_version(version_str):
    """Parse version string, handling dev suffix and build metadata."""
    # Split off build metadata (everything after +)
    version_base = version_str.split("+")[0]

    # Check for dev suffix
    is_dev = "-dev" in version_base
    clean_version = version_base.replace("-dev", "")

    parts = clean_version.split(".")
    if len(parts) != 3:
        raise ValueError(f"Invalid version format: {version_str}")

    return int(parts[0]), int(parts[1]), int(parts[2]), is_dev


def bump_version(addon_path, increment, changelog_message=None, set_dev=False):
    """Bump version with optional dev suffix."""
    config_path = os.path.join(addon_path, "config.yaml")
    if not os.path.exists(config_path):
        config_path = os.path.join(addon_path, "config.json")

    if not os.path.exists(config_path):
        print(f"❌ Error: Config file not found in {addon_path}")
        sys.exit(1)

    print(f"📄 Processing {config_path}...")

    with open(config_path, "r") as f:
        content = f.read()

    # Regex to find version (supports -dev and -dev+commit suffix)
    # Regex to find version (supports -dev and -dev+commit suffix)
    version_pattern = (
        r"""^(version: ["']?)([0-9]+\.[0-9]+\.[0-9]+(?:-dev)?(?:\+[a-f0-9]+)?)(["']?)"""
    )
    match = re.search(version_pattern, content, re.MULTILINE)

    if not match:
        print("❌ Error: Could not find version in config file")
        sys.exit(1)

    current_version = match.group(2)
    print(f"🔹 Current version: {current_version}")

    major, minor, patch, is_dev = parse_version(current_version)

    # If current is dev, just remove -dev for release
    if is_dev and not set_dev:
        new_version = f"{major}.{minor}.{patch}"
        print("📦 Releasing dev version...")
    else:
        # Normal increment
        if increment == "major":
            major += 1
            minor = 0
            patch = 0
        elif increment == "minor":
            minor += 1
            patch = 0
        elif increment == "patch":
            patch += 1
        else:
            print(f"❌ Error: Unknown increment type {increment}")
            sys.exit(1)

        if set_dev:
            # Get current commit SHA for the addon for update tracking
            try:
                result = subprocess.run(
                    ["git", "log", "-1", "--format=%h", "--", addon_path],
                    capture_output=True,
                    text=True,
                )
                commit_sha = result.stdout.strip()[:7] if result.returncode == 0 else ""
            except Exception:
                commit_sha = ""

            if commit_sha:
                new_version = f"{major}.{minor}.{patch}-dev+{commit_sha}"
            else:
                new_version = f"{major}.{minor}.{patch}-dev"
        else:
            new_version = f"{major}.{minor}.{patch}"

    print(f"🔹 New version: {new_version}")

    # Replace version in content
    new_content = content.replace(
        match.group(0), f"{match.group(1)}{new_version}{match.group(3)}"
    )

    with open(config_path, "w") as f:
        f.write(new_content)

    # Only generate changelog for releases, not dev bumps
    if not set_dev:
        print("📝 Generating changelog from git history...")
        new_entry = generate_changelog_entry(new_version, addon_path, changelog_message)

        changelog_path = os.path.join(addon_path, "CHANGELOG.md")
        if os.path.exists(changelog_path):
            print(f"📝 Updating {changelog_path}...")
            with open(changelog_path, "r") as f:
                changelog = f.read()

            if "# Changelog" in changelog:
                changelog = changelog.replace(
                    "# Changelog\n", f"# Changelog\n\n{new_entry}", 1
                )
            else:
                changelog = f"# Changelog\n\n{new_entry}{changelog}"

            with open(changelog_path, "w") as f:
                f.write(changelog)
        else:
            print("⚠️ CHANGELOG.md not found, creating one.")
            with open(changelog_path, "w") as f:
                f.write(f"# Changelog\n\n{new_entry}")

        print(f"📋 Changelog preview:\n{new_entry[:500]}...")

    print(f"✅ {'Dev bump' if set_dev else 'Bumped'} {addon_path} to {new_version}")
    return new_version


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Bump add-on version with auto-generated changelog"
    )
    parser.add_argument("addon", help="Path to add-on directory")
    parser.add_argument(
        "increment", choices=["major", "minor", "patch"], help="Version increment type"
    )
    parser.add_argument("--message", help="Additional changelog message", default=None)
    parser.add_argument(
        "--dev", action="store_true", help="Set version to dev (e.g., 1.2.3-dev)"
    )

    args = parser.parse_args()

    bump_version(args.addon, args.increment, args.message, args.dev)
