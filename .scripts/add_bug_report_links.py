#!/usr/bin/env python3
"""
Add bug report section with pre-filled GitHub issue link to all addon README files.
"""

import argparse
import os
import re
import urllib.parse

import yaml

# Repo Parameters
REPO_URL = "https://github.com/FaserF/hassio-addons"
REPO_OWNER = "FaserF"
REPO_NAME = "hassio-addons"

# Mapping from directory name to dropdown option value in bug_report.yml
ADDON_NAME_MAPPING = {
    "AegisBot": "AegisBot",
    "ShieldDNS": "ShieldDNS",
    "ShieldFile": "ShieldFile",
    "antigravity-server": "antigravity-server",
    "apache2": "apache2",
    "apache2-minimal": "apache2-minimal",
    "apache2-minimal-mariadb": "apache2-minimal-mariadb",
    "bash_script_executer": "bash_script_executer",
    "homeassistant-test-instance": "homeassistant-test-instance",
    "matterbridge": "matterbridge",
    "netboot-xyz": "netboot-xyz",
    "nginx": "nginx",
    "openssl": "openssl",
    "pterodactyl-panel": "pterodactyl-panel",
    "pterodactyl-wings": "pterodactyl-wings",
    "solumati": "solumati",
    "switch_lan_play": "switch_lan_play",
    "switch_lan_play_server": "switch_lan_play_server",
    "tado_aa": "tado_aa",
    "whatsapp": "whatsapp",
    "wiki.js": "wiki.js",
    "wiki.js3": "wiki.js3",
}


def load_addon_config(addon_path):
    """Load config.yaml or config.json."""
    config_yaml = os.path.join(addon_path, "config.yaml")
    config_json = os.path.join(addon_path, "config.json")

    if os.path.exists(config_yaml):
        with open(config_yaml, "r", encoding="utf-8") as f:
            return yaml.safe_load(f), "yaml"
    elif os.path.exists(config_json):
        import json

        with open(config_json, "r", encoding="utf-8") as f:
            return json.load(f), "json"
    return None, None


def get_addon_dropdown_value(addon_dirname):
    """Map addon directory name to dropdown option value."""
    # First try direct mapping
    if addon_dirname in ADDON_NAME_MAPPING:
        return ADDON_NAME_MAPPING[addon_dirname]

    # Fallback: try case-insensitive match
    for key, value in ADDON_NAME_MAPPING.items():
        if key.lower() == addon_dirname.lower():
            return value

    # If no match, use directory name as fallback (as requested)
    return addon_dirname


def generate_bug_report_url(addon_dirname, addon_version):
    """Generate GitHub issue URL with pre-filled values.

    IMPORTANT: GitHub Issue Forms only support pre-filling input and textarea fields
    via URL parameters. Dropdown fields CANNOT be pre-filled via URL.

    For dropdowns, we set default values in the template itself:
    - installation_type: default is "Home Assistant OS" (index 0)
    - addon_name: Cannot be set dynamically (would need template per addon)

    Supported fields (via URL):
    - version_integration (input) - Addon version (can be pre-filled)
    - log_information (textarea) - Log placeholder text (can be pre-filled)

    Fields NOT pre-filled (not meaningful to pre-fill):
    - version (input) - Home Assistant Core version (user-specific, leave empty)
    """
    # Build query parameters - GitHub YAML forms use direct id=value syntax
    params = {
        "template": "bug_report.yml",
        # Input fields - only pre-fill if it makes sense
        "version_integration": str(addon_version),  # Addon version - can be pre-filled
        # version (HA Core version) - NOT pre-filled, user must enter their specific version
        # Textarea fields - pre-fill with helpful placeholder
        "log_information": "Please paste the addon log output here:\n\n",
        # Note: Dropdown fields (addon_name, installation_type) cannot be pre-filled via URL
        # installation_type has default="Home Assistant OS" in template
        # addon_name must be selected manually by user
    }

    # Build URL with proper encoding
    url = f"{REPO_URL}/issues/new"
    query_string = urllib.parse.urlencode(params, doseq=False)
    return f"{url}?{query_string}"


def generate_feature_request_url(addon_dirname):
    """Generate GitHub feature request URL with pre-filled values."""
    addon_name_value = get_addon_dropdown_value(addon_dirname)

    # Build query parameters - GitHub YAML forms use direct id=value syntax
    params = {
        "template": "feature_request.yml",
        "addon_name": addon_name_value,
    }

    # Build URL
    url = f"{REPO_URL}/issues/new"
    query_string = urllib.parse.urlencode(params)
    return f"{url}?{query_string}"


def remove_all_issue_sections(content):
    """Remove all existing bug report and feature request sections from content."""
    # Remove all GitHub issue links (both old and new syntax) - match standalone links
    # This pattern matches the link and the NOTE block that follows (multi-line)
    # Updated to match any URL parameters (more flexible)
    issue_link_pattern = r"(?s)\*\*\[(?:Report a Bug|Request a Feature)\]\(https://github\.com/[^)]+issues/new[^)]+\)\*\*\s*\n\s*> \[!NOTE\].*?automatically included.*?\.\s*\n"
    cleaned = re.sub(
        issue_link_pattern, "", content, flags=re.IGNORECASE | re.MULTILINE
    )

    # Also remove links that might not have the NOTE block (more aggressive cleanup)
    issue_link_simple_pattern = r"\*\*\[(?:Report a Bug|Request a Feature)\]\(https://github\.com/[^)]+issues/new[^)]+\)\*\*"
    cleaned = re.sub(
        issue_link_simple_pattern, "", cleaned, flags=re.IGNORECASE | re.MULTILINE
    )

    # Also remove orphaned introductory text before links (repeat until no more matches)
    # Remove all lines containing these texts that are NOT in a section (no ## header before them)
    lines = cleaned.split("\n")
    filtered_lines = []
    in_section = False

    i = 0
    while i < len(lines):
        line = lines[i]

        # Check if we're entering a section
        if re.match(r"^##\s+", line):
            in_section = True
            filtered_lines.append(line)
            i += 1
            continue

        # Check if line matches orphaned text patterns
        is_orphaned = False
        if re.search(
            r"If you encounter any issues with this add-on, please report them using the link below\.",
            line,
            re.IGNORECASE,
        ):
            if not in_section:
                is_orphaned = True
        elif re.search(
            r"If you have an idea for a new feature or improvement, please use the link below to submit a feature request\.",
            line,
            re.IGNORECASE,
        ):
            if not in_section:
                is_orphaned = True

        if is_orphaned:
            # Skip this line and any following empty lines
            i += 1
            while i < len(lines) and lines[i].strip() == "":
                i += 1
            continue  # Skip this line

        # Reset section flag when we hit a separator (but keep the separator)
        if line.strip() == "---":
            in_section = False

        filtered_lines.append(line)
        i += 1

    cleaned = "\n".join(filtered_lines)

    # Remove bug report sections (with headers) - match from header to next section
    # This pattern should match the entire section including the URL with any parameters
    bug_report_pattern = r"(?s)(---\s*\n\s*)?##\s+.*?[🐛]?\s*[Rr]eport\s+[Aa]\s+[Bb]ug.*?(?=\n---\s*\n\s*##|##\s+[💡]|##\s+[👨‍💻]|$)"
    # Try multiple times to ensure all sections are removed
    while re.search(bug_report_pattern, cleaned, flags=re.IGNORECASE | re.MULTILINE):
        cleaned = re.sub(
            bug_report_pattern, "", cleaned, flags=re.IGNORECASE | re.MULTILINE
        )

    # Remove feature request sections (with headers) - match from header to next section
    feature_request_pattern = r"(?s)(---\s*\n\s*)?##\s+.*?[💡]?\s*[Ff]eature\s+[Rr]equest.*?(?=\n---\s*\n\s*##|##\s+[👨‍💻]|$)"
    # Try multiple times to ensure all sections are removed
    while re.search(
        feature_request_pattern, cleaned, flags=re.IGNORECASE | re.MULTILINE
    ):
        cleaned = re.sub(
            feature_request_pattern, "", cleaned, flags=re.IGNORECASE | re.MULTILINE
        )

    # Remove any remaining orphaned content blocks (introductory text)
    orphan_patterns = [
        r"(?s)(If you encounter any issues with this add-on, please report them using the link below\..*?automatically included in your bug report\.)\s*",
        r"(?s)(If you have an idea for a new feature or improvement.*?automatically included in your feature request\.)\s*",
    ]
    for pattern in orphan_patterns:
        cleaned = re.sub(pattern, "", cleaned, flags=re.IGNORECASE | re.MULTILINE)

    # Clean up multiple consecutive separators and excessive newlines
    cleaned = re.sub(r"---\s*\n\s*---\s*\n", "---\n\n", cleaned)
    cleaned = re.sub(r"\n{3,}", "\n\n", cleaned)
    cleaned = re.sub(r"^\n+", "", cleaned)  # Remove leading newlines
    cleaned = re.sub(r"\n+$", "\n", cleaned)  # Normalize trailing newlines

    return cleaned


def add_issue_sections(content, bug_report_url, feature_request_url):
    """Add bug report and feature request sections to README content."""
    issue_section = f"""## 🐛 Report a Bug

If you encounter any issues with this add-on, please report them using the link below. The issue form will be pre-filled with the add-on information to help us resolve the problem faster.

**[Report a Bug]({bug_report_url})**

> [!NOTE]
> Please use the link above to report problems. This ensures that all necessary information (add-on name, version, etc.) is automatically included in your bug report.

## 💡 Feature Request

If you have an idea for a new feature or improvement, please use the link below to submit a feature request. The form will be pre-filled with the add-on information.

**[Request a Feature]({feature_request_url})**

> [!NOTE]
> Please use the link above to request features. This ensures that the add-on name is automatically included in your feature request.

---

"""

    # Try to find a good insertion point - before "Credits & License" or at the end
    credits_pattern = r"(##\s+.*[Cc]redits.*[Ll]icense|##\s+.*👨‍💻.*[Cc]redits)"
    match = re.search(credits_pattern, content, re.IGNORECASE)

    if match:
        # Insert before Credits section
        insert_pos = match.start()
        # Check if there's already a separator before the credits section
        before_credits = content[:insert_pos].rstrip()
        if before_credits.endswith("---"):
            # Already has separator, don't add another
            return before_credits + "\n\n" + issue_section + content[insert_pos:]
        else:
            # Add separator before issue sections
            return before_credits + "\n\n---\n\n" + issue_section + content[insert_pos:]
    else:
        # Append at the end
        content_stripped = content.rstrip()
        if content_stripped.endswith("---"):
            return content_stripped + "\n\n" + issue_section
        else:
            return content_stripped + "\n\n---\n\n" + issue_section


def process_addon(addon_path, dry_run=False):
    """Process a single addon."""
    addon_dirname = os.path.basename(addon_path)
    readme_path = os.path.join(addon_path, "README.md")

    if not os.path.exists(readme_path):
        print(f"[SKIP] Skipping {addon_dirname}: No README.md found")
        return False

    # Load config
    config, _ = load_addon_config(addon_path)
    if not config:
        print(f"[SKIP] Skipping {addon_dirname}: No config.yaml/json found")
        return False

    # Get addon info
    addon_version = config.get("version", "unknown")
    addon_name = config.get("name", addon_dirname)

    # Generate issue URLs
    bug_report_url = generate_bug_report_url(addon_dirname, addon_version)
    feature_request_url = generate_feature_request_url(addon_dirname)

    # Read README
    with open(readme_path, "r", encoding="utf-8") as f:
        content = f.read()

    # Remove all existing issue sections (handles duplicates)
    cleaned_content = remove_all_issue_sections(content)

    # Add new issue sections
    new_content = add_issue_sections(
        cleaned_content, bug_report_url, feature_request_url
    )

    if dry_run:
        print(f"[DRY RUN] Would update {addon_dirname} (version: {addon_version})")
        print(f"   Bug Report URL: {bug_report_url}")
        print(f"   Feature Request URL: {feature_request_url}")
        return True

    # Write updated README
    with open(readme_path, "w", encoding="utf-8") as f:
        f.write(new_content)

    print(f"[OK] Updated {addon_dirname} (version: {addon_version})")
    return True


def find_addons(base_path):
    """Recursively find add-ons (directories with config.yaml/json)."""
    addons = []

    # Root level check
    for item in os.listdir(base_path):
        item_path = os.path.join(base_path, item)
        if os.path.isdir(item_path) and not item.startswith("."):
            if os.path.exists(os.path.join(item_path, "config.yaml")) or os.path.exists(
                os.path.join(item_path, "config.json")
            ):
                addons.append(item_path)

    # Unsupported folder check
    unsupported_path = os.path.join(base_path, ".unsupported")
    if os.path.exists(unsupported_path):
        for item in os.listdir(unsupported_path):
            item_path = os.path.join(unsupported_path, item)
            if os.path.isdir(item_path):
                if os.path.exists(
                    os.path.join(item_path, "config.yaml")
                ) or os.path.exists(os.path.join(item_path, "config.json")):
                    addons.append(item_path)

    return addons


if __name__ == "__main__":
    # Set UTF-8 encoding for Windows console
    import io
    import sys

    if sys.platform == "win32":
        sys.stdout = io.TextIOWrapper(
            sys.stdout.buffer, encoding="utf-8", errors="replace"
        )
        sys.stderr = io.TextIOWrapper(
            sys.stderr.buffer, encoding="utf-8", errors="replace"
        )

    parser = argparse.ArgumentParser(
        description="Add bug report section with pre-filled GitHub issue link to all addon README files"
    )
    parser.add_argument(
        "--addon",
        help="Process specific addon directory only",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Show what would be changed without making changes",
    )
    args = parser.parse_args()

    base_path = os.getcwd()

    if args.addon:
        # Handle specific path
        path = os.path.abspath(args.addon)
        if os.path.exists(path):
            process_addon(path, dry_run=args.dry_run)
        else:
            print(f"[ERROR] Addon path not found: {path}")
    else:
        found_addons = find_addons(base_path)
        print(f"Found {len(found_addons)} add-ons.\n")

        updated_count = 0
        for addon in found_addons:
            if process_addon(addon, dry_run=args.dry_run):
                updated_count += 1

        print(
            f"\n{'Would update' if args.dry_run else 'Updated'} {updated_count} addon(s)."
        )
