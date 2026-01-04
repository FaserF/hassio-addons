#!/usr/bin/env python3
"""
Add addon-specific content sections to all README files.
"""

import argparse
import os
import re

import yaml

# Repo Parameters
REPO_URL = "https://github.com/FaserF/hassio-addons"


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


def get_apache2_versions_table():
    """Get Apache2 versions table."""
    return """## 🧰 Versions

| Version                                  | Features                                                                     |
| :--------------------------------------- | :--------------------------------------------------------------------------- |
| [Full][full_url]                         | Apache2, PHP 8.4 (with common extensions), MariaDB client, ffmpeg, Mosquitto |
| [Minimal][minimal_url]                   | Apache2 only                                                                 |
| [Minimal + MariaDB][minimal_mariadb_url] | Apache2, MariaDB client, PHP with basic modules                              |

[full_url]: https://github.com/FaserF/hassio-addons/tree/master/apache2
[minimal_url]: https://github.com/FaserF/hassio-addons/tree/master/apache2-minimal
[minimal_mariadb_url]: https://github.com/FaserF/hassio-addons/tree/master/apache2-minimal-mariadb

"""


def get_bt_mqtt_gateway_warning():
    """Get bt-mqtt-gateway unsupported warning."""
    return """> [!WARNING]
> **This add-on is no longer supported.**
> The original repository (wealth/bt-mqtt-gateway) was archived in October 2023.
>
> **Recommended Alternatives for 2025:**
>
> * **OpenMQTTGateway**: Supports ESP32/ESP8266 devices.
> * **Theengs Gateway**: Ideal for Raspberry Pi or existing Linux hosts.
> * **ESPHome Bluetooth Proxy**: Good for Home Assistant native integration (note: may not publish raw MQTT as freely as the others).

"""


def get_minimal_apache_docs_link():
    """Get link to full Apache2 documentation for minimal variants."""
    return """## 📚 Documentation

For complete documentation, configuration options, and detailed information, please refer to the **[Full Apache2 Add-on Documentation](https://github.com/FaserF/hassio-addons/tree/master/apache2)**.

This minimal variant shares the same core functionality and configuration options as the full version, but with reduced dependencies.

"""


def extract_about_from_docs(addon_path):
    """Extract About section from DOCS.md if it exists."""
    docs_path = os.path.join(addon_path, "DOCS.md")
    if not os.path.exists(docs_path):
        return None
    
    with open(docs_path, "r", encoding="utf-8") as f:
        docs_content = f.read()
    
    # Look for "## About" section
    about_match = re.search(r"##\s+About\s*\n(.*?)(?=\n##|$)", docs_content, re.DOTALL | re.IGNORECASE)
    if about_match:
        about_text = about_match.group(1).strip()
        # Clean up the text (remove excessive newlines)
        about_text = re.sub(r"\n{3,}", "\n\n", about_text)
        return about_text
    
    return None


def get_addon_specific_content(addon_dirname, config, addon_path):
    """Get addon-specific content based on addon name."""
    addon_name = config.get("name", addon_dirname) if config else addon_dirname
    
    # Apache2 - Versions table
    if addon_dirname == "apache2":
        return get_apache2_versions_table()
    
    # Apache2 minimal variants - Link to full docs
    if addon_dirname in ["apache2-minimal", "apache2-minimal-mariadb"]:
        return get_minimal_apache_docs_link()
    
    # bt-mqtt-gateway - Unsupported warning
    if addon_dirname == "bt-mqtt-gateway":
        return get_bt_mqtt_gateway_warning()
    
    # For other addons, try to extract About from DOCS.md or use description
    about_text = extract_about_from_docs(addon_path)
    if not about_text and config:
        description = config.get("description", "")
        if description and description != "Home Assistant Add-on":
            about_text = description
    
    if about_text:
        return f"""## 📖 About

{about_text}

"""
    
    return None


def find_insertion_point(content, addon_dirname):
    """Find where to insert addon-specific content (after description, before issue sections)."""
    lines = content.split('\n')
    
    # For bt-mqtt-gateway, insert right after description quote
    if addon_dirname == "bt-mqtt-gateway":
        for i, line in enumerate(lines):
            if line.strip().startswith('>') and 'Bluetooth MQTT Gateway' in line:
                # Find end of quote block
                j = i + 1
                while j < len(lines) and (lines[j].strip().startswith('>') or lines[j].strip() == ""):
                    j += 1
                return j
    
    # For Apache2, insert after description, before any orphaned text
    if addon_dirname == "apache2":
        for i, line in enumerate(lines):
            if line.strip().startswith('>') and 'Open Source Webserver' in line:
                # Find end of quote block
                j = i + 1
                while j < len(lines) and (lines[j].strip().startswith('>') or lines[j].strip() == ""):
                    j += 1
                # Skip orphaned text lines
                while j < len(lines) and lines[j].strip().startswith("If you"):
                    j += 1
                return j
    
    # For minimal Apache variants, insert after description
    if addon_dirname in ["apache2-minimal", "apache2-minimal-mariadb"]:
        for i, line in enumerate(lines):
            if line.strip().startswith('>') and ('Webserver' in line or 'MariaDB' in line):
                # Find end of quote block
                j = i + 1
                while j < len(lines) and (lines[j].strip().startswith('>') or lines[j].strip() == ""):
                    j += 1
                # Skip orphaned text lines
                while j < len(lines) and lines[j].strip().startswith("If you"):
                    j += 1
                return j
    
    # For other addons, insert after description quote or beta warning
    # Look for description quote
    for i, line in enumerate(lines):
        if line.strip().startswith('>') and not line.strip().startswith('> [!'):
            # Find end of quote block
            j = i + 1
            while j < len(lines) and (lines[j].strip().startswith('>') or lines[j].strip() == ""):
                j += 1
            # Skip beta warnings if present
            while j < len(lines) and (lines[j].strip().startswith('> [!') or lines[j].strip() == "---"):
                if lines[j].strip() == "---":
                    j += 1
                    break
                j += 1
            # Skip orphaned text lines
            while j < len(lines) and lines[j].strip().startswith("If you"):
                j += 1
            return j
    
    # Fallback: look for issue sections or credits
    issue_pattern = r"##\s+.*[🐛]|##\s+.*[💡]|##\s+.*[👨‍💻]"
    match = re.search(issue_pattern, content)
    if match:
        return content[:match.start()].count('\n')
    
    # Last resort: after first --- separator
    first_sep = content.find('---')
    if first_sep > 0:
        return content[:first_sep].count('\n') + 1
    
    return len(lines)


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

    # Get addon-specific content
    specific_content = get_addon_specific_content(addon_dirname, config, addon_path)
    
    if not specific_content:
        print(f"[SKIP] Skipping {addon_dirname}: No specific content defined")
        return False

    # Read README
    with open(readme_path, "r", encoding="utf-8") as f:
        content = f.read()

    # Check if content already exists
    # For Apache2 versions table
    if addon_dirname == "apache2" and "## 🧰 Versions" in content:
        print(f"[SKIP] Skipping {addon_dirname}: Versions table already exists")
        return False
    
    # For minimal Apache variants
    if addon_dirname in ["apache2-minimal", "apache2-minimal-mariadb"]:
        if "## 📚 Documentation" in content and "Full Apache2 Add-on Documentation" in content:
            print(f"[SKIP] Skipping {addon_dirname}: Documentation link already exists")
            return False
    
    # For bt-mqtt-gateway
    if addon_dirname == "bt-mqtt-gateway" and "This add-on is no longer supported" in content:
        print(f"[SKIP] Skipping {addon_dirname}: Warning already exists")
        return False
    
    # For other addons with About section
    if specific_content and "## 📖 About" in specific_content:
        if "## 📖 About" in content:
            print(f"[SKIP] Skipping {addon_dirname}: About section already exists")
            return False

    # Find insertion point
    insert_line = find_insertion_point(content, addon_dirname)
    lines = content.split('\n')
    
    # Insert the content
    new_lines = lines[:insert_line]
    
    # Add separator if needed
    if new_lines and new_lines[-1].strip() and not new_lines[-1].strip().startswith('---'):
        new_lines.append("")
    
    # Add the specific content
    new_lines.extend(specific_content.split('\n'))
    
    # Add remaining lines
    new_lines.extend(lines[insert_line:])
    
    new_content = '\n'.join(new_lines)

    if dry_run:
        print(f"[DRY RUN] Would update {addon_dirname}")
        print(f"   Content preview: {specific_content[:100]}...")
        return True

    # Write updated README
    with open(readme_path, "w", encoding="utf-8") as f:
        f.write(new_content)

    print(f"[OK] Updated {addon_dirname}")
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
    import sys
    import io
    if sys.platform == "win32":
        sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
        sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")
    
    parser = argparse.ArgumentParser(
        description="Add addon-specific content sections to README files"
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
        
        print(f"\n{'Would update' if args.dry_run else 'Updated'} {updated_count} addon(s).")
