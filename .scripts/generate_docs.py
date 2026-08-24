#!/usr/bin/env python3
"""
Generate the GitHub Pages website for FaserF's Home Assistant Apps repository.
Extracts complete metadata directly from all addon configs with live search, filters,
architecture badges, modern UI, category grouping, and one-click repo install.
"""

import json
import sys
from pathlib import Path

import yaml

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")

REPO_URL = "https://github.com/FaserF/hassio-addons"
REPO_RAW_URL = "https://raw.githubusercontent.com/FaserF/hassio-addons/master"

import os

# Import single source of truth for add-ons
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from addons_config import DEV_ADDONS, is_dev_addon

# Enhanced emoji/category detection
ICON_MAP = {
    "antigravity-server": "🖥️",
    "antigravity": "🚀",
    "aegisbot": "🤖",
    "entramirror": "☁️",
    "shielddns": "🛡️",
    "shieldfile": "📁",
    "apache2-minimal-mariadb": "🐬",
    "apache2-minimal": "🌐",
    "apache2": "🌐",
    "nginx": "🚦",
    "wordpress": "📝",
    "wiki.js3": "📚",
    "wiki.js": "📚",
    "pterodactyl-panel": "🎮",
    "pterodactyl-wings": "🕹️",
    "bentopdf": "📄",
    "solumati": "❤️",
    "traderepublic": "📈",
    "planka": "📋",
    "komodo": "🦎",
    "dbf": "🚆",
    "er-dashboard": "📊",
    "homeassistant-test-instance": "🧪",
    "netboot-xyz": "👢",
    "openssl": "🔐",
    "switchcraft": "📦",
    "switch_lan_play_server": "🎮",
    "switch_lan_play": "🎮",
    "tado_aa": "🌡️",
    "tt-rss": "📰",
    "whatsapp": "💬",
    "bash_script_executer": "🐚",
    "imapsync": "✉️",
    "matterbridge": "🌉",
    "freenom-dns-updater": "🆓",
    "tuya-convert": "🔌",
    "sap-abap-cloud-dev": "🏢",
    "bt-mqtt-gateway": "📡",
    "xqrepack": "📦",
}

CATEGORY_MAP = {
    # System & Tools
    "bash_script_executer": "Tools & Utilities",
    "openssl": "Tools & Utilities",
    "imapsync": "Tools & Utilities",
    "switchcraft": "Tools & Utilities",
    "bentopdf": "Tools & Utilities",
    "traderepublic": "Tools & Utilities",
    "homeassistant-test-instance": "Developer Tools",
    "antigravity": "AI & Automation",
    "antigravity-server": "AI & Automation",
    "aegisbot": "AI & Automation",
    "entramirror": "Cloud & Backup",
    # Web & Database
    "apache2": "Web Servers",
    "apache2-minimal": "Web Servers",
    "apache2-minimal-mariadb": "Web Servers",
    "nginx": "Web Servers",
    "wordpress": "Content & Knowledge",
    "wiki.js": "Content & Knowledge",
    "wiki.js3": "Content & Knowledge",
    "tt-rss": "Content & Knowledge",
    # Gaming & Entertainment
    "pterodactyl-panel": "Gaming",
    "pterodactyl-wings": "Gaming",
    "switch_lan_play": "Gaming",
    "switch_lan_play_server": "Gaming",
    # Network & Security
    "shielddns": "Security & Network",
    "shieldfile": "Security & Network",
    "netboot-xyz": "Security & Network",
    # Smart Home & IoT
    "whatsapp": "Messaging & Social",
    "solumati": "Messaging & Social",
    "tado_aa": "Climate & Smart Home",
    "dbf": "Dashboards & Media",
    "er-dashboard": "Dashboards & Media",
    "planka": "Productivity",
    "komodo": "DevOps & Infrastructure",
    # Unsupported
    "freenom-dns-updater": "Deprecated",
    "matterbridge": "Deprecated",
    "sap-abap-cloud-dev": "Deprecated",
    "bt-mqtt-gateway": "Deprecated",
    "tuya-convert": "Deprecated",
    "xqrepack": "Deprecated",
}


def get_icon(slug: str, name: str) -> str:
    slug_lower = slug.lower()
    for key, icon in ICON_MAP.items():
        if key == slug_lower:
            return icon
    for key, icon in ICON_MAP.items():
        if key in slug_lower or key in name.lower():
            return icon
    return "📦"


def get_category(slug: str) -> str:
    return CATEGORY_MAP.get(slug.lower(), "General")


def parse_version(version_str: str) -> tuple:
    try:
        clean = version_str.lstrip("v").split("-")[0].split("+")[0]
        parts = clean.split(".")
        return tuple(int(p) for p in parts[:3])
    except Exception:
        return (0, 0, 0)


def extract_metadata(config_path: Path, relative_path: str, is_unsupported: bool) -> dict:
    try:
        with open(config_path, "r", encoding="utf-8") as f:
            config = yaml.safe_load(f) or {}

        slug = str(config.get("slug", config_path.parent.name))
        name = str(config.get("name", slug))
        description = str(config.get("description", "No description provided.")).strip()
        version = str(config.get("version", "0.0.0")).strip()
        arch = config.get("arch", ["aarch64", "amd64"])
        ingress = bool(config.get("ingress", False))
        webui = config.get("webui", None)

        url = config.get(
            "url",
            f"{REPO_URL}/tree/master/{relative_path}",
        )

        stable_url = f"{REPO_URL}/tree/master/{relative_path}"
        edge_url = f"{REPO_URL}/tree/edge/{relative_path}"

        # Fetch Edge branch info (version and commit hash)
        edge_version = version
        edge_commit = ""
        try:
            cmd = ["git", "show", f"origin/edge:{relative_path}/config.yaml"]
            res = subprocess.run(cmd, capture_output=True, text=True, check=True)
            edge_cfg = yaml.safe_load(res.stdout) or {}
            edge_version = str(edge_cfg.get("version", version)).strip()
        except Exception:
            try:
                cmd = ["git", "show", f"edge:{relative_path}/config.yaml"]
                res = subprocess.run(cmd, capture_output=True, text=True, check=True)
                edge_cfg = yaml.safe_load(res.stdout) or {}
                edge_version = str(edge_cfg.get("version", version)).strip()
            except Exception:
                edge_version = f"{version}-edge"

        try:
            cmd_log = ["git", "log", "-1", "--format=%h", "origin/edge", "--", relative_path]
            res_log = subprocess.run(cmd_log, capture_output=True, text=True, check=True)
            edge_commit = res_log.stdout.strip()
        except Exception:
            try:
                cmd_log = ["git", "log", "-1", "--format=%h", "edge", "--", relative_path]
                res_log = subprocess.run(cmd_log, capture_output=True, text=True, check=True)
                edge_commit = res_log.stdout.strip()
            except Exception:
                edge_commit = "HEAD"

        # Status categorization
        if is_unsupported:
            status_text = "Unsupported"
            status_class = "unsupported"
            sort_tier = 2
        elif slug.lower() in DEV_ADDONS or name.lower() in DEV_ADDONS:
            status_text = "Dev / Edge"
            status_class = "beta"
            sort_tier = 1
        else:
            major, _, _ = parse_version(version)
            if major >= 1:
                status_text = "Stable"
                status_class = "stable"
                sort_tier = 0
            else:
                status_text = "Beta"
                status_class = "beta"
                sort_tier = 1

        # Check if local icon/logo exists
        addon_dir = config_path.parent
        has_icon_png = (addon_dir / "icon.png").exists()
        has_logo_png = (addon_dir / "logo.png").exists()

        icon_url = f"{REPO_RAW_URL}/{relative_path}/icon.png" if has_icon_png else None
        logo_url = f"{REPO_RAW_URL}/{relative_path}/logo.png" if has_logo_png else None

        return {
            "slug": slug,
            "name": name,
            "description": description,
            "version": version,
            "edge_version": edge_version,
            "edge_commit": edge_commit,
            "arch": arch,
            "ingress": ingress,
            "has_webui": bool(webui) or ingress,
            "category": get_category(slug),
            "url": url,
            "stable_url": stable_url,
            "edge_url": edge_url,
            "status_text": status_text,
            "status_class": status_class,
            "icon_emoji": get_icon(slug, name),
            "icon_url": icon_url,
            "logo_url": logo_url,
            "has_icon_png": has_icon_png,
            "sort_key": (sort_tier, name.lower()),
        }
    except Exception as e:
        print(f"Error parsing {config_path}: {e}")
        return None


def main():
    repo_root = Path(__file__).resolve().parent.parent
    docs_dir = repo_root / "docs"
    docs_dir.mkdir(exist_ok=True)

    addons = []

    # 1. Main dir addons
    for item in sorted(repo_root.iterdir()):
        if (
            item.is_dir()
            and not item.name.startswith((".", "_"))
            and item.name != "docs"
            and item.name != "node_modules"
            and item.name != "tests"
            and item.name != "addons"
            and item.name != "data"
        ):
            config_path = item / "config.yaml"
            if config_path.exists():
                meta = extract_metadata(config_path, item.name, False)
                if meta:
                    addons.append(meta)

    # 2. Unsupported addons
    unsupported_dir = repo_root / ".unsupported"
    if unsupported_dir.exists():
        for item in sorted(unsupported_dir.iterdir()):
            if item.is_dir():
                config_path = item / "config.yaml"
                if config_path.exists():
                    meta = extract_metadata(config_path, f".unsupported/{item.name}", True)
                    if meta:
                        addons.append(meta)

    # Sort
    addons.sort(key=lambda x: x["sort_key"])

    total = len(addons)
    stable_count = sum(1 for a in addons if a["status_class"] == "stable")
    beta_count = sum(1 for a in addons if a["status_class"] == "beta")
    unsupported_count = sum(1 for a in addons if a["status_class"] == "unsupported")
    ingress_count = sum(1 for a in addons if a["ingress"])

    # Unique categories
    categories = sorted(list(set(a["category"] for a in addons if a["status_class"] != "unsupported")))

    # Generate JSON data embedded for dynamic JS filtering/searching/sorting
    addons_json = json.dumps(addons, ensure_ascii=False)

    # HTML Generator
    html_content = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>FaserF's Home Assistant Apps & Add-ons</title>
    <meta name="description" content="Explore {total} premium Home Assistant Add-ons by FaserF: WordPress, Wiki.js, Antigravity, ShieldDNS, Pterodactyl, Webservers & more. Fast search, categories, and one-click install.">
    <meta name="keywords" content="Home Assistant, Add-ons, Hassio, Docker, Self-Hosted, WordPress, Wiki.js, Antigravity, ShieldDNS, Pterodactyl">
    <meta name="author" content="FaserF">

    <!-- Open Graph / Social -->
    <meta property="og:type" content="website">
    <meta property="og:title" content="FaserF's Home Assistant Apps">
    <meta property="og:description" content="Explore {total} curated, high-quality Home Assistant add-ons. Instant search, filters, and 1-click install.">
    <meta property="og:url" content="https://hassio-addons.fabiseitz.de/">

    <!-- Favicon -->
    <link rel="icon" href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>🏠</text></svg>">
    <meta name="theme-color" content="#0d1117">

    <link rel="stylesheet" href="css/style.css">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">
</head>
<body>

    <!-- Header / Navbar -->
    <nav class="navbar">
        <div class="nav-container">
            <a href="index.html" class="nav-brand">
                <span class="brand-icon">🏠</span>
                <span class="brand-name">FaserF's Add-ons</span>
            </a>
            <div class="nav-links">
                <a href="index.html" class="nav-link active">Apps Hub</a>
                <a href="requests.html" class="nav-link">App Requests</a>
                <a href="support.html" class="nav-link support-btn">❤️ Support</a>
                <a href="https://github.com/FaserF/hassio-addons" target="_blank" rel="noopener" class="nav-link github-link" title="GitHub Repository">
                    <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                        <path d="M12 .5C5.73.5.5 5.73.5 12c0 5.08 3.29 9.38 7.86 10.89.57.11.78-.25.78-.55v-2.06c-3.2.7-3.87-1.54-3.87-1.54-.52-1.33-1.28-1.68-1.28-1.68-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.18 1.76 1.18 1.02 1.75 2.68 1.24 3.33.95.1-.74.4-1.24.72-1.53-2.55-.29-5.23-1.28-5.23-5.69 0-1.26.45-2.29 1.18-3.09-.12-.29-.51-1.46.11-3.05 0 0 .96-.31 3.15 1.18a10.96 10.96 0 0 1 5.74 0c2.18-1.49 3.14-1.18 3.14-1.18.63 1.59.24 2.76.12 3.05.74.8 1.18 1.83 1.18 3.09 0 4.42-2.69 5.39-5.25 5.67.41.36.78 1.07.78 2.15v3.19c0 .3.2.67.79.55A11.52 11.52 0 0 0 23.5 12C23.5 5.73 18.27.5 12 .5z"/>
                    </svg>
                </a>
            </div>
        </div>
    </nav>

    <!-- Hero Section -->
    <header class="hero">
        <div class="hero-content container">
            <div class="hero-badges">
                <span class="badge-tag">⚡ Multi-Arch (aarch64 & amd64)</span>
                <span class="badge-tag">🔄 Auto-Updating Releases</span>
                <span class="badge-tag">🔒 Privacy-First & Self-Hosted</span>
            </div>
            <h1 class="hero-title">FaserF's Home Assistant Apps</h1>
            <p class="hero-subtitle">
                A curated collection of {total} community add-ons — from webservers and developer tools to self-hosted cloud and media services.
            </p>

            <div class="hero-actions">
                <a href="https://my.home-assistant.io/redirect/supervisor_add_addon_repository/?repository_url=https%3A%2F%2Fgithub.com%2FFaserF%2Fhassio-addons" class="cta-button primary" target="_blank" rel="noopener">
                    <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
                        <path d="M10,20V14H14V20H19V12H22L12,3L2,12H5V20H10Z" />
                    </svg>
                    <span>Add to Home Assistant</span>
                </a>
                <button class="cta-button secondary" id="copyRepoBtn" onclick="copyRepoUrl()" title="Copy Repository URL">
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                    </svg>
                    <span id="copyBtnText">Copy Repo URL</span>
                </button>
            </div>
        </div>
    </header>

    <!-- Main Content -->
    <main class="container main-content">

        <!-- Quick Stats Overview -->
        <div class="stats-cards">
            <div class="stat-card clickable" onclick="setFilter('all')" title="Show All Add-ons">
                <div class="stat-icon">📦</div>
                <div class="stat-info">
                    <div class="stat-number" id="statTotal">{total}</div>
                    <div class="stat-label">Total Add-ons</div>
                </div>
            </div>
            <div class="stat-card clickable" onclick="setFilter('stable')" title="Show Stable Add-ons">
                <div class="stat-icon text-success">✅</div>
                <div class="stat-info">
                    <div class="stat-number">{stable_count}</div>
                    <div class="stat-label">Stable Releases</div>
                </div>
            </div>
            <div class="stat-card clickable" onclick="setFilter('beta')" title="Show Beta Add-ons">
                <div class="stat-icon text-warning">⚡</div>
                <div class="stat-info">
                    <div class="stat-number">{beta_count}</div>
                    <div class="stat-label">Beta Builds</div>
                </div>
            </div>
            <div class="stat-card clickable" onclick="setFilter('ingress')" title="Show Ingress Enabled Add-ons">
                <div class="stat-icon text-primary">🌐</div>
                <div class="stat-info">
                    <div class="stat-number">{ingress_count}</div>
                    <div class="stat-label">Ingress Enabled</div>
                </div>
            </div>
            <div class="stat-card clickable" onclick="setFilter('unsupported')" title="Show Deprecated Add-ons">
                <div class="stat-icon text-danger">🛡️</div>
                <div class="stat-info">
                    <div class="stat-number">{unsupported_count}</div>
                    <div class="stat-label">Unsupported</div>
                </div>
            </div>
        </div>

        <!-- Search, Filter & Control Toolbar -->
        <div class="control-panel">
            <div class="search-box">
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" class="search-icon">
                    <circle cx="11" cy="11" r="8"></circle>
                    <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                </svg>
                <input type="text" id="searchInput" placeholder="Search by name, description, category, or architecture (e.g. Ingress, MariaDB, aarch64)..." autocomplete="off" />
                <button id="clearSearchBtn" onclick="clearSearch()" class="clear-btn" style="display: none;" title="Clear search">✕</button>
            </div>

            <div class="filter-controls">
                <!-- Status Filter Pills -->
                <div class="filter-group status-pills" id="statusFilterGroup">
                    <button class="pill-btn active" data-status="all" onclick="setStatusFilter('all')">All ({total})</button>
                    <button class="pill-btn" data-status="stable" onclick="setStatusFilter('stable')">Stable ({stable_count})</button>
                    <button class="pill-btn" data-status="beta" onclick="setStatusFilter('beta')">Beta ({beta_count})</button>
                    <button class="pill-btn" data-status="ingress" onclick="setStatusFilter('ingress')">Ingress ({ingress_count})</button>
                    <button class="pill-btn" data-status="unsupported" onclick="setStatusFilter('unsupported')">Unsupported ({unsupported_count})</button>
                </div>

                <!-- Category & Architecture Dropdowns -->
                <div class="select-controls">
                    <select id="categorySelect" onchange="applyFilters()">
                        <option value="all">All Categories</option>
                        {"".join(f'<option value="{c}">{c}</option>' for c in categories)}
                        <option value="Deprecated">Deprecated / Unsupported</option>
                    </select>

                    <select id="archSelect" onchange="applyFilters()">
                        <option value="all">All Architectures</option>
                        <option value="aarch64">aarch64 (ARM64, Pi 4/5)</option>
                        <option value="amd64">amd64 (x86_64, PC)</option>
                    </select>

                    <select id="sortSelect" onchange="applyFilters()">
                        <option value="default">Sort: Default (Status & Name)</option>
                        <option value="name_asc">Name (A → Z)</option>
                        <option value="name_desc">Name (Z → A)</option>
                        <option value="version_desc">Version (Highest First)</option>
                    </select>
                </div>
            </div>
        </div>

        <!-- Filter Feedback / Count -->
        <div class="results-header">
            <span id="resultsCount">Showing {total} add-ons</span>
            <button id="resetAllBtn" class="text-btn" onclick="resetFilters()" style="display: none;">Reset all filters</button>
        </div>

        <!-- Addons Dynamic Grid -->
        <div class="addons-grid" id="addonsGrid">
            <!-- Rendered dynamically by JavaScript with instant search -->
        </div>

        <!-- Empty State -->
        <div class="empty-state" id="emptyState" style="display: none;">
            <div class="empty-icon">🔍</div>
            <h3>No add-ons match your criteria</h3>
            <p>Try refining your search terms or clearing your current filter tags.</p>
            <button class="cta-button secondary" onclick="resetFilters()">Reset Search & Filters</button>
        </div>

    </main>

    <!-- Footer -->
    <footer>
        <div class="container footer-container">
            <div class="footer-col">
                <div class="brand-name">FaserF's Home Assistant Apps</div>
                <p class="footer-desc">
                    High performance, secure, and maintained add-ons for your smart home ecosystem.
                </p>
                <div class="footer-badges">
                    <a href="https://github.com/FaserF/hassio-addons/stargazers" target="_blank" rel="noopener">
                        <img src="https://img.shields.io/github/stars/FaserF/hassio-addons?style=flat&logo=github&color=03a9f4" alt="GitHub Stars">
                    </a>
                    <a href="https://github.com/FaserF/hassio-addons/actions" target="_blank" rel="noopener">
                        <img src="https://img.shields.io/github/actions/workflow/status/FaserF/hassio-addons/orchestrator-lint.yaml?label=CI&style=flat" alt="CI Status">
                    </a>
                </div>
            </div>

            <div class="footer-col">
                <h4>Quick Navigation</h4>
                <ul>
                    <li><a href="index.html">Apps Overview</a></li>
                    <li><a href="requests.html">App Requests FAQ</a></li>
                    <li><a href="support.html">Support & Donate</a></li>
                    <li><a href="https://github.com/FaserF/hassio-addons/issues" target="_blank" rel="noopener">Issue Tracker</a></li>
                </ul>
            </div>

            <div class="footer-col">
                <h4>Repository Links</h4>
                <ul>
                    <li><a href="https://github.com/FaserF/hassio-addons" target="_blank" rel="noopener">Main GitHub Repo</a></li>
                    <li><a href="https://github.com/FaserF/ha-whatsapp" target="_blank" rel="noopener">ha-whatsapp Integration</a></li>
                    <li><a href="https://github.com/FaserF/AegisBot" target="_blank" rel="noopener">AegisBot Telegram Defender</a></li>
                    <li><a href="https://github.com/FaserF/EntraMirror" target="_blank" rel="noopener">EntraMirror</a></li>
                </ul>
            </div>
        </div>

        <div class="footer-bottom container">
            <p>&copy; 2026 FaserF. All rights reserved. • Powered by GitHub Pages.</p>
        </div>
    </footer>

    <!-- Toast Notification -->
    <div id="toast" class="toast">Copied repository URL to clipboard!</div>

    <!-- Embedded Data & Interactive App Logic -->
    <script>
        const ADDONS_DATA = {addons_json};
        const REPO_URL = "https://github.com/FaserF/hassio-addons";

        let currentStatusFilter = "all";
        let searchQuery = "";
        let selectedCategory = "all";
        let selectedArch = "all";
        let selectedSort = "default";

        function init() {{
            const searchParam = new URLSearchParams(window.location.search).get("q");
            if (searchParam) {{
                document.getElementById("searchInput").value = searchParam;
                searchQuery = searchParam.toLowerCase();
            }}

            const statusParam = new URLSearchParams(window.location.search).get("status");
            if (statusParam) {{
                currentStatusFilter = statusParam;
            }}

            updatePillsUI();
            renderAddons();

            // Search event listener
            const input = document.getElementById("searchInput");
            input.addEventListener("input", (e) => {{
                searchQuery = e.target.value.trim().toLowerCase();
                document.getElementById("clearSearchBtn").style.display = searchQuery ? "block" : "none";
                renderAddons();
            }});
        }}

        function setStatusFilter(status) {{
            currentStatusFilter = status;
            updatePillsUI();
            renderAddons();
        }}

        function setFilter(status) {{
            setStatusFilter(status);
            document.getElementById("addonsGrid").scrollIntoView({{ behavior: "smooth" }});
        }}

        function updatePillsUI() {{
            document.querySelectorAll("#statusFilterGroup .pill-btn").forEach(btn => {{
                if (btn.getAttribute("data-status") === currentStatusFilter) {{
                    btn.classList.add("active");
                }} else {{
                    btn.classList.remove("active");
                }}
            }});
        }}

        function applyFilters() {{
            selectedCategory = document.getElementById("categorySelect").value;
            selectedArch = document.getElementById("archSelect").value;
            selectedSort = document.getElementById("sortSelect").value;
            renderAddons();
        }}

        function clearSearch() {{
            const input = document.getElementById("searchInput");
            input.value = "";
            searchQuery = "";
            document.getElementById("clearSearchBtn").style.display = "none";
            renderAddons();
        }}

        function resetFilters() {{
            currentStatusFilter = "all";
            searchQuery = "";
            selectedCategory = "all";
            selectedArch = "all";
            selectedSort = "default";

            document.getElementById("searchInput").value = "";
            document.getElementById("clearSearchBtn").style.display = "none";
            document.getElementById("categorySelect").value = "all";
            document.getElementById("archSelect").value = "all";
            document.getElementById("sortSelect").value = "default";

            updatePillsUI();
            renderAddons();
        }}

        function renderAddons() {{
            const grid = document.getElementById("addonsGrid");
            const emptyState = document.getElementById("emptyState");
            const countElem = document.getElementById("resultsCount");
            const resetBtn = document.getElementById("resetAllBtn");

            const isFiltered = currentStatusFilter !== "all" || searchQuery !== "" || selectedCategory !== "all" || selectedArch !== "all" || selectedSort !== "default";
            resetBtn.style.display = isFiltered ? "inline-block" : "none";

            let filtered = ADDONS_DATA.filter(addon => {{
                // Status filter
                if (currentStatusFilter === "stable" && addon.status_class !== "stable") return false;
                if (currentStatusFilter === "beta" && addon.status_class !== "beta") return false;
                if (currentStatusFilter === "unsupported" && addon.status_class !== "unsupported") return false;
                if (currentStatusFilter === "ingress" && !addon.ingress) return false;

                // Category filter
                if (selectedCategory !== "all") {{
                    if (selectedCategory === "Deprecated" && addon.status_class !== "unsupported") return false;
                    if (selectedCategory !== "Deprecated" && addon.category !== selectedCategory) return false;
                }}

                // Architecture filter
                if (selectedArch !== "all") {{
                    if (!addon.arch || !addon.arch.includes(selectedArch)) return false;
                }}

                // Search query
                if (searchQuery) {{
                    const fullText = (
                        addon.name + " " +
                        addon.slug + " " +
                        addon.description + " " +
                        addon.category + " " +
                        (addon.arch || []).join(" ") + " " +
                        (addon.ingress ? "ingress web ui" : "")
                    ).toLowerCase();

                    if (!fullText.includes(searchQuery)) return false;
                }}

                return true;
            }});

            // Sorting
            if (selectedSort === "name_asc") {{
                filtered.sort((a, b) => a.name.localeCompare(b.name));
            }} else if (selectedSort === "name_desc") {{
                filtered.sort((a, b) => b.name.localeCompare(a.name));
            }} else if (selectedSort === "version_desc") {{
                filtered.sort((a, b) => b.version.localeCompare(a.version, undefined, {{ numeric: true, sensitivity: 'base' }}));
            }} else {{
                // Default sort: Tier (Stable -> Beta -> Unsupported) then Name
                const tierMap = {{ "stable": 0, "beta": 1, "unsupported": 2 }};
                filtered.sort((a, b) => {{
                    const tierDiff = tierMap[a.status_class] - tierMap[b.status_class];
                    if (tierDiff !== 0) return tierDiff;
                    return a.name.localeCompare(b.name);
                }});
            }}

            countElem.innerText = `Showing ${{filtered.length}} of ${{ADDONS_DATA.length}} add-ons`;

            if (filtered.length === 0) {{
                grid.innerHTML = "";
                emptyState.style.display = "block";
                return;
            }}

            emptyState.style.display = "none";

            let html = "";
            for (const addon of filtered) {{
                const archBadges = (addon.arch || []).map(a => `<span class="arch-badge">${{a}}</span>`).join("");
                const ingressBadge = addon.ingress ? `<span class="feature-badge" title="Ingress Web UI Supported">🌐 Ingress</span>` : "";

                // Icon preview
                let iconDisplay = `<span class="emoji-icon">${{addon.icon_emoji}}</span>`;

                html += `
                    <div class="addon-card ${{addon.status_class}}" data-slug="${{addon.slug}}">
                        <div class="card-top">
                            <div class="addon-icon">
                                ${{iconDisplay}}
                            </div>
                            <div class="addon-title-wrap">
                                <div class="addon-title" title="${{addon.name}}">${{addon.name}}</div>
                                <div class="addon-category">${{addon.category}}</div>
                            </div>
                            <span class="status-tag ${{addon.status_class}}">${{addon.status_text}}</span>
                        </div>

                        <div class="addon-desc">${{addon.description}}</div>

                        <div class="addon-badges-row">
                            <div class="arch-list">${{archBadges}}</div>
                            ${{ingressBadge}}
                        </div>

                        <div class="addon-meta">
                            <div class="version-row">
                                <span class="version-label">Stable</span>
                                <span class="version-value">
                                    <a href="${{addon.stable_url}}" class="version-link" target="_blank" rel="noopener">v${{addon.version}}</a>
                                </span>
                            </div>
                            <div class="version-row">
                                <span class="version-label">Edge</span>
                                <span class="version-value">
                                    <a href="${{addon.edge_url}}" class="edge-link" target="_blank" rel="noopener">v${{addon.edge_version}} <span class="commit-tag">(${{addon.edge_commit}})</span></a>
                                </span>
                            </div>
                        </div>

                        <div class="addon-footer">
                            <a href="${{addon.url}}" class="card-btn secondary" target="_blank" rel="noopener">
                                📖 Documentation
                            </a>
                            <a href="https://my.home-assistant.io/redirect/supervisor_addon/?addon=${{addon.slug}}&repository_url=https%3A%2F%2Fgithub.com%2FFaserF%2Fhassio-addons" class="card-btn primary install-btn" target="_blank" rel="noopener" title="Open and install directly in your Home Assistant instance">
                                ⚡ Install
                            </a>
                        </div>
                    </div>
                `;
            }}

            grid.innerHTML = html;
        }}

        function copyRepoUrl() {{
            const url = "https://github.com/FaserF/hassio-addons";
            navigator.clipboard.writeText(url).then(() => {{
                const toast = document.getElementById("toast");
                toast.classList.add("show");
                const btnText = document.getElementById("copyBtnText");
                btnText.innerText = "Copied!";
                setTimeout(() => {{
                    toast.classList.remove("show");
                    btnText.innerText = "Copy Repo URL";
                }}, 2500);
            }}).catch(err => {{
                console.error("Clipboard copy failed:", err);
            }});
        }}

        // Initialize when DOM is ready
        document.addEventListener("DOMContentLoaded", init);
    </script>
</body>
</html>
"""

    output_path = docs_dir / "index.html"
    with open(output_path, "w", encoding="utf-8") as f:
        f.write(html_content)

    print(f"Generated modern docs/index.html with {total} add-ons.")


if __name__ == "__main__":
    main()
