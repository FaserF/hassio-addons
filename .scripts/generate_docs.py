#!/usr/bin/env python3
"""
Generate the GitHub Pages index.html from addon metadata.
"""

import json
import os
import sys
from pathlib import Path

import yaml

# Template for the HTML file
# We use a simple string replacement for simplicity and robustness
HTML_TEMPLATE = """<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>FaserF's Home Assistant Add-ons</title>
    <meta name="description" content="Premium Home Assistant Add-ons Repository: WordPress, Wiki.js, Pterodactyl, Webservers & more.">
    <link rel="stylesheet" href="css/style.css">
    <!-- Fonts -->
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;500;700&display=swap" rel="stylesheet">
    <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400&display=swap" rel="stylesheet">
</head>
<body>

    <header>
        <div class="container">
            <h1>FaserF's Home Assistant Add-ons</h1>
            <p class="subtitle">A curated collection of advanced add-ons including WordPress, Wiki.js, Pterodactyl, and more. Built with Platinum Quality Standards.</p>

            <a href="https://my.home-assistant.io/redirect/supervisor_add_addon_repository/?repository_url=https%3A%2F%2Fgithub.com%2FFaserF%2Fhassio-addons" class="cta-button" target="_blank">
                <svg viewBox="0 0 24 24" fill="currentColor">
                    <path d="M10,20V14H14V20H19V12H22L12,3L2,12H5V20H10Z" />
                </svg>
                Add Repository to Home Assistant
            </a>
        </div>
    </header>

    <main class="container">

        <div class="stats-bar">
            <span>📦 Total Add-ons: <strong>{total_addons}</strong></span>
            <span>✅ Stable: <strong>{stable_count}</strong></span>
            <span>⚠️ Beta: <strong>{beta_count}</strong></span>
        </div>

        <div class="addons-grid">
            {addons_grid}
        </div>

    </main>

    <footer>
        <p>&copy; 2026 FaserF. All known & unknown rights reserved. <br> Powered by GitHub Pages.</p>
        <p><a href="https://github.com/FaserF/hassio-addons">View Repository on GitHub</a></p>
    </footer>

</body>
</html>
"""

ADDON_CARD_TEMPLATE = """
            <div class="addon-card {status_class}">
                <div class="addon-header">
                    <div class="addon-icon">{icon}</div>
                    <div class="addon-title">{name}</div>
                </div>
                <div class="addon-desc">{description}</div>
                <div class="addon-meta">
                    <span class="version">v{version}</span>
                </div>
                <div class="addon-footer">
                    <span class="tag {status_class}">{status_text}</span>
                    <a href="{url}" class="view-link" target="_blank">View Docs →</a>
                </div>
            </div>
"""

# Map MDI icons to emojis (fallback) or use text
# Ideal would be SVG or font, but for now we stick to simple emoji/text mapping logic or generic icons
# based on names if specific icon not found.
# For this implementation particularity we will try to be smart or generic.
ICON_MAP = {
    "wordpress": "📝",
    "wiki": "📚",
    "wikijs": "📚",
    "wikijs3": "📚",
    "antigravity": "🚀",
    "pterodactyl": "🎮",
    "apache": "🌐",
    "nginx": "🚦",
    "shield": "🛡️",
    "dns": "🛡️",
    "sap": "🏢",
    "mariadb": "🐬",
    "mysql": "🐬",
    "php": "🐘",
    "proxy": "🔄",
    "gateway": "🚪",
    "bot": "🤖",
    "terminal": "💻",
    "ssh": "🔒",
    "lan": "🎮",
    "switch": "🎮",
    "netboot": "👢",
    "openssl": "🔐",
    "tado": "🌡️",
    "whatsapp": "💬",
    "freenom": "🆓",
    "matterbridge": "🌉",
    "tuya": "🔌",
    "xqrepack": "📦"
}

def get_icon(slug: str, name: str) -> str:
    """Guess emoji icon based on slug/name."""
    search_str = (slug + " " + name).lower()
    for key, icon in ICON_MAP.items():
        if key in search_str:
            return icon
    return "📦" # Default package icon


def parse_version(version_str: str) -> tuple:
    """Parse a version string into major, minor, patch tuple."""
    try:
        # Handle "v" prefix or dev suffixes
        clean = version_str.lstrip("v").split("-")[0].split("+")[0]
        parts = clean.split(".")
        return tuple(int(p) for p in parts[:3])
    except (ValueError, AttributeError):
        return (0, 0, 0)


def extract_metadata(config_path: Path, relative_path: str, is_unsupported: bool) -> dict:
    """Extract metadata from config.yaml."""
    try:
        with open(config_path, "r", encoding="utf-8") as f:
            config = yaml.safe_load(f)

        name = config.get("name", "Unknown")
        slug = config.get("slug", "unknown")
        description = config.get("description", "No description provided.")
        version = str(config.get("version", "0.0.0"))
        url = config.get("url", f"https://github.com/FaserF/hassio-addons/tree/master/{relative_path}")

        # Determine status
        if is_unsupported:
            status_text = "Unsupported"
            status_class = "unsupported"
        else:
            major, _, _ = parse_version(version)
            if major >= 1:
                status_text = "Stable"
                status_class = "stable"
            else:
                status_text = "Beta"
                status_class = "beta"

        return {
            "name": name,
            "description": description,
            "version": version,
            "url": url,
            "status_text": status_text,
            "status_class": status_class,
            "icon": get_icon(slug, name),
            "sort_key": (0 if status_class == "stable" else 1 if status_class == "beta" else 2, name)
        }
    except Exception as e:
        print(f"Error parsing {config_path}: {e}")
        return None


def main():
    repo_root = Path(__file__).parent.parent
    docs_dir = repo_root / "docs"

    addons = []

    # scan for addons
    # 1. Main dir
    for item in sorted(repo_root.iterdir()):
        if item.is_dir() and not item.name.startswith((".", "_")) and item.name != "docs":
            config_path = item / "config.yaml"
            if config_path.exists():
                meta = extract_metadata(config_path, item.name, False)
                if meta:
                    addons.append(meta)

    # 2. Unsupported
    unsupported_dir = repo_root / ".unsupported"
    if unsupported_dir.exists():
        for item in sorted(unsupported_dir.iterdir()):
            if item.is_dir():
                config_path = item / "config.yaml"
                if config_path.exists():
                    meta = extract_metadata(config_path, f".unsupported/{item.name}", True)
                    if meta:
                        addons.append(meta)

    # Sort: Stable first, then Beta, then Unsupported. Alphabetical within groups.
    addons.sort(key=lambda x: x["sort_key"])

    # Generate Grid HTML
    grid_html = ""
    for addon in addons:
        grid_html += ADDON_CARD_TEMPLATE.format(
            name=addon["name"],
            description=addon["description"],
            version=addon["version"],
            url=addon["url"],
            status_text=addon["status_text"],
            status_class=addon["status_class"],
            icon=addon["icon"]
        )

    # Stats
    total = len(addons)
    stable = sum(1 for a in addons if a["status_class"] == "stable")
    beta = sum(1 for a in addons if a["status_class"] == "beta")

    # Final HTML
    final_html = HTML_TEMPLATE.format(
        addons_grid=grid_html,
        total_addons=total,
        stable_count=stable,
        beta_count=beta
    )

    # Write output
    output_path = docs_dir / "index.html"
    with open(output_path, "w", encoding="utf-8") as f:
        f.write(final_html)

    print(f"✅ Generated docs/index.html with {total} addons.")

if __name__ == "__main__":
    main()
