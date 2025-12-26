#!/usr/bin/env python3
import os
import re
import subprocess
import sys

import yaml


def run_command(cmd):
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, check=True)
        return result.stdout.strip()
    except subprocess.CalledProcessError as e:
        print(f"Error running {' '.join(cmd)}: {e.stderr}", file=sys.stderr)
        return None


def get_base_ref():
    # In PRs, use the base ref (e.g. master)
    base_ref = os.environ.get("GITHUB_BASE_REF")
    if base_ref:
        return f"origin/{base_ref}"

    # For pushes to master, compare with previous commit
    return "HEAD~1"


def main():
    base = get_base_ref()
    current = "HEAD"

    config_path = ".scripts/verify_addons/config/test-config.yaml"
    script_paths = [
        ".scripts/verify_addons/",
        ".scripts/supervisor_mock.py",
        ".scripts/lib/common.ps1",
    ]

    # 1. Check if relevant files changed
    cmd = ["git", "diff", "--name-only", base, current]
    changed_files = run_command(cmd)
    if changed_files is None:
        sys.exit(1)

    changed_files = changed_files.splitlines()

    has_script_changes = False
    for f in changed_files:
        if any(f.startswith(p) for p in script_paths) and f != config_path:
            has_script_changes = True
            break

    if not has_script_changes:
        print("No changes to test script detected.")
        sys.exit(0)

    # 2. Check if version was already bumped
    def get_version_at(ref):
        try:
            content = run_command(["git", "show", f"{ref}:{config_path}"])
            if not content:
                return None
            data = yaml.safe_load(content)
            return data.get("scriptVersion")
        except (yaml.YAMLError, OSError, ValueError):
            return None

    old_version = get_version_at(base)

    if not os.path.exists(config_path):
        print(f"Config file {config_path} not found.", file=sys.stderr)
        sys.exit(1)

    try:
        with open(config_path, "r") as f:
            current_data = yaml.safe_load(f)
            new_version = current_data.get("scriptVersion")
    except (yaml.YAMLError, OSError) as e:
        print(f"Error reading config file: {e}", file=sys.stderr)
        sys.exit(1)

    if old_version and new_version and old_version != new_version:
        print(f"Version already bumped from {old_version} to {new_version}.")
        sys.exit(0)

    # 3. Bump version
    if not new_version:
        print("Could not find scriptVersion in config.", file=sys.stderr)
        sys.exit(1)

    parts = new_version.split(".")
    if len(parts) != 3:
        print(f"Invalid version format: {new_version}", file=sys.stderr)
        sys.exit(1)

    try:
        parts[2] = str(int(parts[2]) + 1)
    except ValueError:
        print(f"Invalid version segment: {parts[2]}", file=sys.stderr)
        sys.exit(1)
    bumped_version = ".".join(parts)

    print(f"Bumping script version: {new_version} -> {bumped_version}")

    with open(config_path, "r") as f:
        content = f.read()

    pattern = r'(scriptVersion:\s*")[^"]+(")'
    new_content = re.sub(pattern, rf"\1{bumped_version}\2", content)

    if new_content == content:
        print(
            "Error: Regex replacement failed (content unchanged). Check config format.",
            file=sys.stderr,
        )
        sys.exit(1)

    with open(config_path, "w") as f:
        f.write(new_content)

    print("Done.")


if __name__ == "__main__":
    main()
