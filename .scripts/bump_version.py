import argparse
import os
import re
import sys
from datetime import datetime


def bump_version(addon_path, increment, changelog_message=None):
    config_path = os.path.join(addon_path, "config.yaml")
    # Support json if needed, but checking for yaml first
    if not os.path.exists(config_path):
        config_path = os.path.join(addon_path, "config.json")

    if not os.path.exists(config_path):
        print(f"❌ Error: Config file not found in {addon_path}")
        sys.exit(1)

    print(f"📄 Processing {config_path}...")

    with open(config_path, "r") as f:
        content = f.read()

    # Regex to find version
    # version: "1.2.3" or version: 1.2.3
    version_pattern = r'^(version: ["\']?)([0-9]+\.[0-9]+\.[0-9]+)(["\']?)'
    match = re.search(version_pattern, content, re.MULTILINE)

    if not match:
        print("❌ Error: Could not find version in config file")
        sys.exit(1)

    current_version = match.group(2)
    print(f"🔹 Current version: {current_version}")

    major, minor, patch = map(int, current_version.split("."))

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

    new_version = f"{major}.{minor}.{patch}"
    print(f"🔹 New version: {new_version}")

    # Replace version in content
    new_content = content.replace(
        match.group(0), f"{match.group(1)}{new_version}{match.group(3)}"
    )

    with open(config_path, "w") as f:
        f.write(new_content)

    # Update Changelog
    changelog_path = os.path.join(addon_path, "CHANGELOG.md")
    if os.path.exists(changelog_path):
        print(f"📝 Updating {changelog_path}...")
        with open(changelog_path, "r") as f:
            changelog = f.read()

        # Find where to insert (after first header usually, or top)
        # Ideally searching for # Changelog

        entry_date = datetime.now().strftime("%Y-%m-%d")
        new_entry = f"## {new_version}\n"
        if changelog_message:
            new_entry += f"- {changelog_message}\n"
        else:
            new_entry += f"- Bump version to {new_version}\n"
        new_entry += "\n"

        # Simple insertion after "# Changelog" if present, else prepend
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
            f.write(
                f"# Changelog\n\n## {new_version}\n- {changelog_message or 'Initial release'}\n"
            )

    print(f"✅ Bumped {addon_path} to {new_version}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Bump add-on version")
    parser.add_argument("addon", help="Path to add-on directory")
    parser.add_argument(
        "increment", choices=["major", "minor", "patch"], help="Version increment type"
    )
    parser.add_argument("--message", help="Changelog message", default=None)

    args = parser.parse_args()

    bump_version(args.addon, args.increment, args.message)
