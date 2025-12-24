import os
import re
import yaml
import json
import argparse
import shutil

# Repo Parameters
REPO_URL = "https://github.com/FaserF/hassio-addons"
REPO_HASH = "c1e285b7"  # Hash for FaserF/hassio-addons
MAINTAINER = "FaserF"


BETA_NOTICE = """
> [!CAUTION]
> **Experimental / Beta Status**
>
> This add-on is still in development and/or primarily developed for personal use.
> It is not extensively tested yet, but is expected to work fundamentally.
"""


def load_addon_config(addon_path):
    """Load config.yaml or config.json."""
    config_yaml = os.path.join(addon_path, "config.yaml")
    config_json = os.path.join(addon_path, "config.json")

    if os.path.exists(config_yaml):
        with open(config_yaml, "r", encoding="utf-8") as f:
            return yaml.safe_load(f), "yaml"
    elif os.path.exists(config_json):
        with open(config_json, "r", encoding="utf-8") as f:
            return json.load(f), "json"
    return None, None


def is_beta(version_str):
    """Check if version is < 1.0.0. Returns True if Beta."""
    if not version_str:
        return True  # Default to beta if no version

    # Simple semantic split
    try:
        ver = str(version_str).lower()
        # constant "dev" or "edge" -> Beta
        if "dev" in ver or "edge" in ver or "beta" in ver or "rc" in ver:
            return True

        parts = ver.split(".")
        major = int(parts[0])
        if major < 1:
            return True
        return False
    except:
        return True


def generate_badges(addon_slug, addon_name):
    """Generate standard badges."""
    return f"""[![Open your Home Assistant instance and show the add-on dashboard.](https://my.home-assistant.io/badges/supervisor_addon.svg)](https://my.home-assistant.io/redirect/supervisor_addon/?addon={addon_slug})
[![Home Assistant Add-on](https://img.shields.io/badge/home%20assistant-addon-blue.svg)](https://www.home-assistant.io/addons/)
[![GitHub Release](https://img.shields.io/github/v/release/FaserF/hassio-addons?include_prereleases&style=flat-square)]({REPO_URL}/releases)
![Project Maintenance](https://img.shields.io/badge/maintainer-{MAINTAINER}-blue?style=flat-square)"""


def clean_existing_content(content):
    """Clean existing content by stripping headers, badges, and stopping at Configuration."""
    lines = content.splitlines()
    cleaned_lines = []
    skip_mode = True

    for line in lines:
        sline = line.strip()

        # --- TOP LEVEL SKIPPING (Header info) ---
        if skip_mode:
            if not sline:
                continue

            # Detect Badges
            if "]" in sline and (
                "badge" in sline
                or "shields.io" in sline
                or "my.home-assistant.io" in sline
                or "github.com" in sline
                or "ko-fi" in sline
            ):
                continue

            # Detect Title
            if sline.startswith("# "):
                continue

            # Detect Logo
            if "![Logo]" in sline or "logo.png" in sline or "icon.png" in sline:
                continue

            # Detect Quotes/Description (Common at top)
            if sline.startswith(">"):
                continue

            # Detect Beta Warning (Avoid duplicates)
            if (
                "Experimental / Beta Status" in sline
                or "primarily developed for personal use" in sline
            ):
                continue

            # Detect HR
            if sline == "---" or sline == "***":
                continue

            # Check for header start that indicates content
            # If we see "## About", skip the header line but start content mode
            if sline.startswith("## About") or sline.startswith("## 📖 About"):
                skip_mode = False
                continue

            # If we see any other header, it's content
            if sline.startswith("##"):
                skip_mode = False
                cleaned_lines.append(line)
                continue

            # Normal text -> Content (e.g. usage instructions)
            skip_mode = False
            cleaned_lines.append(line)

        else:
            # --- CONTENT PROCESSING (AGGRESSIVE) ---

            # Filter H1 titles inside body (Artifacts)
            if sline.startswith("# "):
                continue

            # Filter Badges/Logos inside content body
            if "]" in sline and (
                "badge" in sline
                or "shields.io" in sline
                or "my.home-assistant.io" in sline
            ):
                continue
            if "![Logo]" in sline or "logo.png" in sline:
                continue

            # Filter headers that we RE-ADD (Duplicates)
            if sline.startswith("## About") or sline.startswith("## 📖 About"):
                continue
            if sline.startswith("## Credits") or sline.startswith("## 👨‍💻 Credits"):
                continue
            if sline.startswith("## License"):
                continue

            # Filter Configuration Header -> STOP PROCESSING
            # We regenerate this section fully
            if sline.startswith("## Configuration") or sline.startswith(
                "## ⚙️ Configuration"
            ):
                break

            # Filter HRs in content to avoid stacking separators
            if sline == "---" or sline == "***":
                continue

            # Fix duplicates: If line matches our standard Badge line exactly, remove it.
            if "my.home-assistant.io/badges/supervisor_addon.svg" in sline:
                continue

            # Filter legacy markdown reference badges (e.g. ![...][...-shield])
            if re.search(r"!\[.*\]\[.*-shield\]", sline, re.IGNORECASE):
                continue

            cleaned_lines.append(line)

    # Remove leading/trailing empty lines
    while cleaned_lines and not cleaned_lines[0].strip():
        cleaned_lines.pop(0)
    while cleaned_lines and not cleaned_lines[-1].strip():
        cleaned_lines.pop()

    return "\n".join(cleaned_lines)


def maximize_config_example(config, config_type):
    """Generate a clean configuration example."""
    if not config or "options" not in config:
        return ""

    options = config["options"]

    if config_type == "json":
        return f"```json\n{json.dumps(options, indent=2)}\n```"
    else:
        # Simple YAML dump for options
        return f"```yaml\n{yaml.dump(options, default_flow_style=False)}```"


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

    # Also check if cwd is an addon
    if os.path.exists(os.path.join(base_path, "config.yaml")) or os.path.exists(
        os.path.join(base_path, "config.json")
    ):
        pass

    return addons


def process_addon(addon_path):
    print(f"Processing {addon_path}...")
    readme_path = os.path.join(addon_path, "README.md")

    if not os.path.exists(readme_path):
        print(f"Skipping {addon_path}: No README.")
        return

    # 1. Read Content
    with open(readme_path, "r", encoding="utf-8") as f:
        content = f.read()

    # 2. Extract description (simple heuristic or use clean_existing_content)
    config, config_type = load_addon_config(addon_path)
    if not config:
        print(f"Warning: No config for {addon_path}")
        return

    addon_dirname = os.path.basename(addon_path)
    name = config.get("name", addon_dirname)
    description = config.get("description", "Home Assistant Add-on")
    version = config.get("version", "0.0.0")
    slug = f"{REPO_HASH}_{addon_dirname}"  # e.g. c1e285b7_whatsapp

    # 3. Clean Content
    body_content = clean_existing_content(content)

    # 4. Construct New README

    # Header
    new_content = f"# {name}\n\n"
    new_content += "![Logo](logo.png)\n\n"
    new_content += generate_badges(slug, name) + "\n\n"
    new_content += f"> {description}\n\n"
    new_content += "---\n\n"

    # Beta Warning
    if is_beta(version):
        new_content += BETA_NOTICE.strip() + "\n\n"
        new_content += "---\n\n"

    # About
    new_content += "## 📖 About\n\n"
    new_content += body_content + "\n\n"
    new_content += "---\n\n"

    # Configuration
    new_content += "## ⚙️ Configuration\n\n"
    new_content += "Configure the add-on via the **Configuration** tab in the Home Assistant add-on page.\n\n"
    new_content += "### Options\n\n"
    new_content += maximize_config_example(config, config_type) + "\n\n"
    new_content += "---\n\n"

    # Credits & License
    new_content += "## 👨‍💻 Credits & License\n\n"
    new_content += "This project is open-source and available under the MIT License.\n"
    new_content += f"Maintained by **{MAINTAINER}**.\n"

    # 5. Write
    with open(readme_path, "w", encoding="utf-8") as f:
        f.write(new_content)

    print(f"✅ {addon_dirname} Standardized (Beta={is_beta(version)}).")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--addon", help="Run for specific addon directory")
    args = parser.parse_args()

    base_path = os.getcwd()

    if args.addon:
        # Handle specific path
        path = os.path.abspath(args.addon)
        if os.path.exists(path):
            process_addon(path)
        else:
            print(f"Addon path not found: {path}")
    else:
        found_addons = find_addons(base_path)
        print(f"Found {len(found_addons)} add-ons.")
        for addon in found_addons:
            process_addon(addon)
