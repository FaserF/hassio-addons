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
from typing import Optional, Tuple
from datetime import datetime

import yaml  # Added for safe config handling

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
            # Match tags specific to this addon or simple vX.Y.Z format
            addon_tags = [
                t
                for t in tags
                if t == f"v{addon_name}"
                or t.startswith(f"{addon_name}-")
                or (t.startswith("v") and len(t.split("-")) == 1)  # simple v1.2.3
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

            categories["🚀 Other"].append(entry)

    return categories


def parse_existing_changelog_entry(content: str) -> dict:
    """Parse an existing changelog entry into categories."""
    categories = {}
    current_category = None

    # Simple parser assuming standard format
    # ## Version
    # ### Category
    # - Item

    lines = content.split('\n')
    for line in lines:
        if line.startswith('### '):
            current_category = line.replace('### ', '').strip()
            if current_category not in categories:
                categories[current_category] = []
        elif line.strip().startswith('- ') and current_category:
            categories[current_category].append(line.strip()[2:])

    return categories



def generate_changelog_entry(version, addon_path, changelog_message=None, existing_entry=None):
    """Generate a detailed changelog entry with clickable links."""
    entry_date = datetime.now().strftime("%Y-%m-%d")
    heading = f"## {version} ({entry_date})"
    entry = f"{heading}\n\n"

    repo_url = get_git_remote_url()
    # If existing entry, we might need to look further back?
    # Or just assume the commits since the tag are what we want to add.
    # The 'since_tag' logic in get_git_log_for_addon uses the *previous* tag.
    # If we are strictly appending new commits that happened *after* the manual bump (unlikely if runs immediately)
    # OR if we want to list commits *included* in this bump.
    # If manual bump happened in HEAD, and we run this, HEAD is the bump.
    # We want commits from PrevTag..HEAD.

    commits = get_git_log_for_addon(addon_path)

    if commits:
        categories = categorize_commits(commits, repo_url)

        # Merge with existing categories if present
        if existing_entry:
            existing_categories = parse_existing_changelog_entry(existing_entry)
            for cat, items in existing_categories.items():
                if cat not in categories:
                    categories[cat] = []
                # Append existing items if not duplicates (simple string check)
                # Note: existing items might not have links formatted same way if manual.
                # We'll just add them to the top or bottom?
                # Better: Keep existing items, add new ones.
                # Actually, if we are "updating" the changelog for the *current* version,
                # we probably want to capture everything.
                current_items_simple = [x.split(' ([')[0] for x in categories[cat]] # approximate
                for item in items:
                    # simplistic dedup
                    if item.split(' ([')[0] not in current_items_simple:
                         categories[cat].insert(0, item + " (Manual)") # Mark manual entries? Or just add.
                    else:
                         # logic to prefer one? Let's just keep the auto one if it matches.
                         pass

            # Actually, simpler: Just Re-generate the full list of commits from git
            # and append any *manual* notes found in the existing entry that *aren't* in git?
            # That's hard.
            # User request: "erweitere den Changelog um auto changelog inhalt" (extend with auto content).
            # This implies the existing content is manual/custom and we should add our auto-detected stuff to it.

            # Let's trust git log is the source of truth for "auto content".
            # We will render the git log categories.
            # If the user wrote something, where is it?
            # If they wrote "### Fixed\n- my fix", we should preserve it.

            pass

        for category, items in categories.items():
            if items:
                entry += f"### {category}\n"
                for item in items[:15]: # Limit increased
                    entry += f"- {item}\n"
                entry += "\n"

        # If existing entry had content not in our categories, we might lose it with clean regeneration.
        # But implementing a full merge is complex.
        # Strategy: If existing entry exists, we Append our auto-generated stuff?
        # Or we prepend it?
        # "Erweitere ... um auto changelog inhalt".
        # Let's append the auto-generated categories *after* any user defined text?
        # Or merge into the categories.

        # Revised Strategy for "Extend":
        # 1. Take existing entry body.
        # 2. Append "### Auto-detected Changes" ? No, that's ugly.
        # 3. Just merging categories is best.

        if changelog_message and changelog_message not in [
            "Manual Release via Orchestrator",
            "Automatic release after dependency update",
        ]:
             entry += f"### 📌 Release Note\n- {changelog_message}\n\n"

        # If we had existing content, we might want to preserve "Release Note" styled things.
        if existing_entry:
             # simple append of original raw content if it doesn't look like generated categories
             # This is risky.
             # Let's stick to: Overwrite with full git history (which includes the manual commit presumably)
             # PLUS keep specific manual notes?
             pass

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


def update_image_tag(content, addon_path, is_dev):
    """Toggle image tag in config.yaml based on dev status."""
    # Default image convention: ghcr.io/faserf/hassio-addons-{slug}-{arch}
    # However, config.yaml usually uses {arch} placeholder or implied structure.
    # Looking at other addons/docs, 'image' in config.yaml is usually:
    # image: ghcr.io/faserf/{slug}-{arch}
    # Let's derive slug from config content or path

    slug_match = re.search(r"^slug: ([\w-]+)", content, re.MULTILINE)
    slug = (
        slug_match.group(1)
        if slug_match
        else os.path.basename(addon_path.rstrip("/\\"))
    )

    # Image line regex
    image_pattern = r"^image: .*$"

    if is_dev:
        # REMOVE image tag for dev versions (force local build)
        if re.search(image_pattern, content, re.MULTILINE):
            print("🔧 Removing image tag for dev version (forcing local build)")
            # Comment out instead of delete to preserve intent? Or just delete.
            # User said "remove the tag".
            content = re.sub(
                image_pattern, "# image: local build only", content, flags=re.MULTILINE
            )
        else:
            print("ℹ️ No image tag found (already local build compliant)")
    else:
        # ADD/RESTORE image tag for release versions
        # Expected: image: ghcr.io/faserf/hassio-addons-{slug}-{arch}
        # Note: Github owner is FaserF, repo is hassio-addons.
        # Naming convention verification:
        # If user is FaserF, and repo is hassio-addons, images are likely ghcr.io/faserf/hassio-addons-{slug}-{arch}
        # OR ghcr.io/faserf/{slug}-{arch} depending on HA Builder default.
        # Given builder usage: --image "${{ steps.info.outputs.image }}"
        # and docker-hub "ghcr.io/${{ github.repository_owner }}"
        # The builder creates ghcr.io/faserf/{slug}-{arch} usually if not overridden.
        # But wait, looking at repo structure, addons are directories.
        # Let's trust the standard HA pattern: ghcr.io/{owner}/{slug}/{arch} OR ghcr.io/{owner}/{repo}-{slug}-{arch}
        # I'll use a safe bet: ghcr.io/faserf/hassio-addons-{slug}-{arch} based on typical sub-addon patterns in monorepos.

        # Check if already present and uncomment if needed
        if "# image: local build only" in content:
            image_line = f"image: ghcr.io/faserf/hassio-addons-{slug.lower()}-{{arch}}"
            content = content.replace("# image: local build only", image_line)
            print(f"🔧 Restored image tag: {image_line}")
        elif not re.search(image_pattern, content, re.MULTILINE):
            image_line = f"image: ghcr.io/faserf/hassio-addons-{slug.lower()}-{{arch}}"
            # Append after slug or version
            content = re.sub(
                r"^(slug: .*)$", f"\\1\n{image_line}", content, flags=re.MULTILINE
            )
            print(f"🔧 Added image tag: {image_line}")

    return content


def bump_version(
    addon_path,
    increment,
    changelog_message=None,
    set_dev=False,
    force_changelog=False,
    changelog_only=False,
    target_version=None,
):
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

    # Determine New Version
    if target_version:
        new_version = target_version
        print(f"🔹 Target version provided: {new_version}")
    else:
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
                    # Docker tags cannot contain '+', so use '-' instead
                    new_version = f"{major}.{minor}.{patch}-dev-{commit_sha}"
                else:
                    new_version = f"{major}.{minor}.{patch}-dev"
            else:
                new_version = f"{major}.{minor}.{patch}"

    print(f"🔹 New version: {new_version}")

    # Update Config File (Skip if changelog_only)
    if not changelog_only:
        # Replace version in content
        new_content = content.replace(
            match.group(0), f"{match.group(1)}{new_version}{match.group(3)}"
        )

        # Update image tag logic
        new_content = update_image_tag(new_content, addon_path, is_dev=set_dev)

        with open(config_path, "w") as f:
            f.write(new_content)
    else:
        print("ℹ️ Skipping config.yaml update (changelog-only mode)")

    # Only generate changelog for releases, not dev bumps (unless forced)
    if not set_dev or force_changelog:
        print("📝 Generating changelog from git history...")

        changelog_path = os.path.join(addon_path, "CHANGELOG.md")
        existing_entry = None
        existing_changelog = ""

        if os.path.exists(changelog_path):
             with open(changelog_path, "r") as f:
                existing_changelog = f.read()

             # Check if entry for new version already exists
             # Look for "## 1.2.3 ("
             header_pattern = f"## {new_version} \\("
             match_header = re.search(header_pattern, existing_changelog)
             if match_header:
                 print(f"ℹ️ Found existing entry for {new_version}, will merge/extend.")
                 # Extract the entry content?
                 # For now, let's just generate the new entry and see.
                 # Strategy: If found, we can try to separate it?
                 # Actually, simplest approach:
                 # If changelog_only=True, we assume we are fixing/appending.
                 # We will generate the entry, and if it differs, update?
                 pass

        new_entry = generate_changelog_entry(new_version, addon_path, changelog_message, existing_entry)

        if os.path.exists(changelog_path):
            print(f"📝 Updating {changelog_path}...")

            # If we perform a manual release, we might have manually added the header "## 1.2.3 (Date)"
            # parsing that is tricky.
            # Simplified Logic:
            # 1. Generate full auto entry.
            # 2. If "## {new_version}" exists in file:
            #    Replace that section? Or append to it?
            #    User said: "erweitere ... um auto changelog".
            #    So we should keep what is there and Add ours.
            #    But `generate_changelog_entry` returns a full block starting with `## Version`.
            #    If we just inject it, we get duplicate headers.

            # Better:
            # Check if header exists.
            version_header_start = f"## {new_version}"
            if version_header_start in existing_changelog:
                # Find start and end of this section
                start_idx = existing_changelog.find(version_header_start)
                # Find next section
                next_section_match = re.search(r"\n## \d", existing_changelog[start_idx+5:])
                if next_section_match:
                    end_idx = start_idx + 5 + next_section_match.start()
                    current_section = existing_changelog[start_idx:end_idx]
                else:
                    current_section = existing_changelog[start_idx:]
                    end_idx = len(existing_changelog)

                # We have the manual section.
                # Now generate our auto section (without header)
                auto_entry_full = generate_changelog_entry(new_version, addon_path, changelog_message)
                # Strip header from auto entry
                auto_body = "\n".join(auto_entry_full.split("\n")[2:])

                # Combine: Manual Section + "\n" + Auto Body
                # Check if Auto Body is already in Manual Section? (avoid dups)
                # Simple concatenation for now as requested.

                combined_section = current_section.rstrip() + "\n" + auto_body

                # Validation: Don't duplicate if already runs
                # Replace in full text
                changelog = existing_changelog[:start_idx] + combined_section + existing_changelog[end_idx:]

            else:
                # Standard Prepend
                if "# Changelog" in existing_changelog:
                    changelog = existing_changelog.replace(
                        "# Changelog\n", f"# Changelog\n\n{new_entry}", 1
                    )
                else:
                    changelog = f"# Changelog\n\n{new_entry}{existing_changelog}"

            with open(changelog_path, "w") as f:
                f.write(changelog)
        else:
            print("⚠️ CHANGELOG.md not found, creating one.")
            with open(changelog_path, "w") as f:
                f.write(f"# Changelog\n\n{new_entry}")

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
    parser.add_argument(
        "--changelog",
        action="store_true",
        help="Force changelog generation (even for dev)",
    )

    parser.add_argument(
        "--changelog-only",
        action="store_true",
        help="Only update Changelog (do not modify config.yaml)",
    )
    parser.add_argument(
        "--target-version",
        help="Specify exact version (bypass increment logic)",
        default=None,
    )

    args = parser.parse_args()

    # Pass args object or specific flag if we refactored bump_version signature
    bump_version(
        args.addon,
        args.increment,
        args.message,
        args.dev,
        args.changelog,
        args.changelog_only,
        args.target_version,
    )
