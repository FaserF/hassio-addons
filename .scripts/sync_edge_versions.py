#!/usr/bin/env python3
"""
Synchronize add-on versions on the edge branch.

Rules:
1. Every add-on on the edge branch must have a dev version: X.Y.Z-dev-<timestamp>-<sha>.
2. Base version for an add-on on edge is derived from master's stable version + 1 patch increment.
   e.g. Master version: 2.1.8 -> Edge version: 2.1.9-dev-<timestamp>-<sha>.
3. If the add-on already has a dev version on edge AND its base version is strictly greater
   than master's stable version (e.g. edge has 1.3.8-dev while master has 1.3.7), AND the add-on
   was not changed in the current push/trigger, that ahead dev version is preserved.
4. If a new stable release occurred on master (master >= edge base semver), or if edge had a stable
   version without -dev, or if the add-on was modified in this push, edge gets rebased to:
   (master_major).(master_minor).(master_patch + 1)-dev-<timestamp>-<sha>.
"""

import os
import re
import subprocess
from datetime import datetime


def parse_semver(v: str) -> tuple[int, int, int]:
    """Parse semver string into a (major, minor, patch) integer tuple."""
    clean = v.split("-dev")[0].split("-")[0].strip().lstrip("v")
    parts = []
    for p in clean.split("."):
        digits = re.match(r"^(\d+)", p)
        if digits:
            parts.append(int(digits.group(1)))
        else:
            parts.append(0)
    while len(parts) < 3:
        parts.append(0)
    return (parts[0], parts[1], parts[2])


def get_commit_sha(addon_path: str) -> str:
    """Get the latest short commit SHA for the addon directory or HEAD."""
    try:
        res = subprocess.run(
            ["git", "log", "-1", "--format=%h", "--", addon_path],
            capture_output=True,
            text=True,
            encoding="utf-8",
        )
        sha = res.stdout.strip()[:7]
        if sha:
            return sha
    except Exception:
        pass

    try:
        res = subprocess.run(
            ["git", "rev-parse", "--short", "HEAD"],
            capture_output=True,
            text=True,
            encoding="utf-8",
        )
        return res.stdout.strip()[:7]
    except Exception:
        return "dev"


def get_version_from_config(config_path: str) -> str | None:
    """Extract version string from config.yaml."""
    if not os.path.isfile(config_path):
        return None
    try:
        with open(config_path, "r", encoding="utf-8") as f:
            for line in f:
                if line.startswith("version:"):
                    return line.split(":", 1)[1].strip().strip('"').strip("'")
    except Exception as e:
        print(f"⚠️ Error reading {config_path}: {e}")
    return None


def set_version_in_config(config_path: str, new_version: str) -> bool:
    """Update version string in config.yaml."""
    if not os.path.isfile(config_path):
        return False
    try:
        with open(config_path, "r", encoding="utf-8") as f:
            content = f.read()

        version_pattern = r"""^(version:\s*["']?)([^"'\s]+)(["']?)"""
        match = re.search(version_pattern, content, re.MULTILINE)
        if not match:
            print(f"⚠️ Could not find version line in {config_path}")
            return False

        new_content = (
            content[: match.start()] + f"{match.group(1)}{new_version}{match.group(3)}" + content[match.end() :]
        )
        with open(config_path, "w", encoding="utf-8") as f:
            f.write(new_content)
        return True
    except Exception as e:
        print(f"⚠️ Error writing {config_path}: {e}")
        return False


def load_previous_edge_versions(versions_file: str) -> dict[str, str]:
    """Load key-value pairs of addon=version from saved edge versions file."""
    versions = {}
    if not versions_file or not os.path.isfile(versions_file):
        return versions

    try:
        with open(versions_file, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line or "=" not in line:
                    continue
                app, ver = line.split("=", 1)
                versions[app.strip()] = ver.strip()
    except Exception as e:
        print(f"⚠️ Error loading {versions_file}: {e}")
    return versions


def main():
    versions_file = os.environ.get("VERSIONS_FILE", "")
    changed_apps_env = os.environ.get("CHANGED_APPS", "")

    changed_apps = set()
    if changed_apps_env:
        for app in changed_apps_env.replace(",", "\n").splitlines():
            app = app.strip()
            if app:
                changed_apps.add(app)

    prev_edge_versions = load_previous_edge_versions(versions_file)
    timestamp = datetime.now().strftime("%Y%m%d-%H%M")

    # Discover all add-ons in root directory
    addon_dirs = []
    for entry in sorted(os.listdir(".")):
        if os.path.isdir(entry) and not entry.startswith("."):
            cfg = os.path.join(entry, "config.yaml")
            if os.path.isfile(cfg):
                addon_dirs.append(entry)

    print(f"🔍 Synchronizing edge dev versions for {len(addon_dirs)} add-ons...")
    print(f"   Changed add-ons in this run: {sorted(list(changed_apps)) if changed_apps else 'None'}")

    bumped_count = 0
    preserved_count = 0

    for app in addon_dirs:
        config_path = os.path.join(app, "config.yaml")
        current_master_version = get_version_from_config(config_path)
        if not current_master_version:
            continue

        prev_edge_ver = prev_edge_versions.get(app)
        is_changed = app in changed_apps

        master_major, master_minor, master_patch = parse_semver(current_master_version)

        # Check if previous edge version is valid, has -dev, and is ahead of master base
        should_preserve = False
        if prev_edge_ver and "-dev" in prev_edge_ver and not is_changed:
            edge_major, edge_minor, edge_patch = parse_semver(prev_edge_ver)
            if (edge_major, edge_minor, edge_patch) > (master_major, master_minor, master_patch):
                should_preserve = True

        if should_preserve and prev_edge_ver:
            # Preserve existing ahead dev version on edge
            set_version_in_config(config_path, prev_edge_ver)
            print(f"  📌 {app}: preserved edge dev version {prev_edge_ver} (ahead of master {current_master_version})")
            preserved_count += 1
        else:
            # Generate new dev version based on master stable + 1 patch
            sha = get_commit_sha(app)
            new_patch = master_patch + 1
            new_dev_version = f"{master_major}.{master_minor}.{new_patch}-dev-{timestamp}-{sha}"
            set_version_in_config(config_path, new_dev_version)
            reason = "changed in this push" if is_changed else f"rebased onto master {current_master_version}"
            print(f"  ⚡ {app}: {current_master_version} -> {new_dev_version} ({reason})")
            bumped_count += 1

    print("\n✅ Edge version synchronization complete!")
    print(f"   ⚡ Bumped / Rebased: {bumped_count}")
    print(f"   📌 Preserved ahead: {preserved_count}")


if __name__ == "__main__":
    main()
