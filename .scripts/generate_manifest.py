"""Generate project_manifest.json and project_connections.json for the hassio-addons repository.

Scans all addon directories (identified by config.yaml) and emits two JSON files:
  - project_manifest.json   — repo-wide overview (addons, file tree, metadata)
  - project_connections.json — per-addon file connection map

Run from the repository root:
    python .scripts/generate_manifest.py
"""

import datetime
import json
import os
import re

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MANIFEST_FILE = os.path.join(PROJECT_ROOT, "project_manifest.json")
CONNECTIONS_FILE = os.path.join(PROJECT_ROOT, "project_connections.json")

IGNORE_DIRS = {
    ".git",
    "__pycache__",
    "node_modules",
    ".pytest_cache",
    ".mypy_cache",
    ".ruff_cache",
    ".idea",
    ".vscode",
    ".system_generated",
    "scratch",
    ".github",
    "_images",
    "tmp",
    "antigravity-server",
    "homeassistant-test-instance",
}

IGNORE_FILES = {
    "package-lock.json",
    "yarn.lock",
    ".DS_Store",
    "project_manifest.json",
    "project_connections.json",
}

ALLOWED_EXTENSIONS = {
    ".py",
    ".sh",
    ".yml",
    ".yaml",
    ".md",
    ".json",
    ".toml",
    ".html",
    ".css",
    ".js",
    ".txt",
    ".conf",
    ".ini",
    ".cfg",
}

# Addon directories that are intentionally skipped (too large / not standard)
CI_EXCLUDED_ADDONS = {"sap-abap-cloud-dev"}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _read(path: str) -> str:
    """Return file content as string, empty string on any error."""
    try:
        with open(path, "r", encoding="utf-8", errors="ignore") as fh:
            return fh.read()
    except Exception:
        return ""


def _parse_yaml_field(content: str, field: str) -> str:
    """Naive single-line YAML field extractor (avoids yaml dependency)."""
    for line in content.splitlines():
        stripped = line.strip()
        if stripped.startswith(f"{field}:"):
            value = stripped[len(f"{field}:"):].strip().strip('"').strip("'")
            return value
    return ""


def _parse_yaml_list_field(content: str, field: str) -> list:
    """Extract a simple YAML list field (e.g. arch:) as a Python list."""
    results = []
    in_block = False
    for line in content.splitlines():
        stripped = line.strip()
        if stripped.startswith(f"{field}:"):
            in_block = True
            # Inline list: arch: [amd64, aarch64]
            inline = stripped[len(f"{field}:"):].strip()
            if inline.startswith("["):
                results = [v.strip().strip('"') for v in inline.strip("[]").split(",")]
                break
            continue
        if in_block:
            if stripped.startswith("-"):
                results.append(stripped.lstrip("- ").strip().strip('"'))
            else:
                break
    return results


# ---------------------------------------------------------------------------
# Addon discovery
# ---------------------------------------------------------------------------


def discover_addons() -> list[dict]:
    """Return a list of addon metadata dicts, one per addon directory."""
    addons = []
    for entry in sorted(os.listdir(PROJECT_ROOT)):
        if entry.startswith("."):
            continue
        if entry in IGNORE_DIRS or entry in CI_EXCLUDED_ADDONS:
            continue
        addon_dir = os.path.join(PROJECT_ROOT, entry)
        config_path = os.path.join(addon_dir, "config.yaml")
        if not os.path.isdir(addon_dir) or not os.path.isfile(config_path):
            continue

        content = _read(config_path)
        addon = {
            "slug": entry,
            "name": _parse_yaml_field(content, "name") or entry,
            "version": _parse_yaml_field(content, "version"),
            "description": _parse_yaml_field(content, "description"),
            "arch": _parse_yaml_list_field(content, "arch"),
            "image": _parse_yaml_field(content, "image"),
            "has_dockerfile": os.path.isfile(os.path.join(addon_dir, "Dockerfile")),
            "has_run_sh": os.path.isfile(os.path.join(addon_dir, "run.sh")),
            "has_rootfs": os.path.isdir(os.path.join(addon_dir, "rootfs")),
            "has_translations": os.path.isdir(os.path.join(addon_dir, "translations")),
            "has_www": os.path.isdir(os.path.join(addon_dir, "www")),
            "has_admin": os.path.isdir(os.path.join(addon_dir, "admin")),
            "has_changelog": os.path.isfile(os.path.join(addon_dir, "CHANGELOG.md")),
        }
        addons.append(addon)
    return addons


# ---------------------------------------------------------------------------
# File tree
# ---------------------------------------------------------------------------


def generate_file_tree() -> dict:
    """Build a filtered file tree for the whole repo."""
    tree: dict[str, list[str]] = {}
    for root, dirs, files in os.walk(PROJECT_ROOT):
        # Prune ignored directories in-place
        dirs[:] = [
            d for d in dirs
            if d not in IGNORE_DIRS and not d.startswith(".")
        ]
        rel_root = os.path.relpath(root, PROJECT_ROOT).replace(os.sep, "/")

        valid_files = []
        for f in files:
            if f in IGNORE_FILES or f.startswith("."):
                continue
            ext = os.path.splitext(f)[1].lower()
            if ext in ALLOWED_EXTENSIONS or f in {"Dockerfile", "Makefile", "VERSION"}:
                valid_files.append(f)

        if valid_files:
            tree[rel_root] = sorted(valid_files)
    return tree


# ---------------------------------------------------------------------------
# Manifest
# ---------------------------------------------------------------------------


def generate_manifest(addons: list[dict]) -> None:
    """Write project_manifest.json to the repository root."""
    print("Generating project_manifest.json …")

    manifest = {
        "project": "hassio-addons",
        "purpose": "Custom Home Assistant Add-on repository maintained by FaserF",
        "connections_map_reference": (
            "project_connections.json (per-addon file mapping for AI agents)"
        ),
        "timestamp": datetime.datetime.now().isoformat(),
        "stack": {
            "runtime": "Home Assistant Supervisor (s6-overlay, Bashio)",
            "languages": "Shell (Bash), Python, YAML",
            "container": "Docker (multi-arch: aarch64, amd64)",
            "ci_cd": "GitHub Actions (orchestrator-*.yaml)",
        },
        "addons": addons,
        "addon_count": len(addons),
        "ai_instructions": {
            "navigation": [
                "Each addon lives in its own top-level directory named by its slug.",
                "Read project_connections.json to find files for a specific addon.",
                "config.yaml defines the addon schema, options, and image.",
                "Dockerfile and run.sh contain the build and runtime logic.",
                "rootfs/ mirrors the container filesystem (init scripts, config templates).",
                "translations/ holds Home Assistant UI translation strings.",
                "www/ holds any static web assets served via HA ingress.",
            ],
            "coding_rules": [
                "Use Bashio helpers (bashio::config, bashio::log.*) in shell scripts.",
                "All shell scripts must pass ShellCheck (severity: warning).",
                "Dockerfile must pass hadolint.",
                "config.yaml schema must be valid Home Assistant addon schema.",
                "Never hardcode secrets or tokens in any file.",
                "Keep CHANGELOG.md up to date when bumping versions.",
            ],
            "test_commands": [
                "hadolint <Addon>/Dockerfile",
                "shellcheck <Addon>/run.sh",
                "yamllint <Addon>/config.yaml",
            ],
        },
        "commands": {
            "lint_dockerfile": "hadolint <addon>/Dockerfile",
            "lint_shell": "shellcheck <addon>/run.sh",
            "lint_yaml": "yamllint .",
            "lint_markdown": "markdownlint '**/*.md'",
            "run_tests": "pytest tests/",
            "generate_manifest": "python .scripts/generate_manifest.py",
        },
        "file_tree": generate_file_tree(),
    }

    _write_json(MANIFEST_FILE, manifest, key_exclude="timestamp")
    print(f"  -> {MANIFEST_FILE} ({os.path.getsize(MANIFEST_FILE):,} bytes)")


# ---------------------------------------------------------------------------
# Connections
# ---------------------------------------------------------------------------


def generate_connections(addons: list[dict]) -> None:
    """Write project_connections.json to the repository root."""
    print("Generating project_connections.json …")

    connections: dict[str, dict] = {}
    for addon in addons:
        slug = addon["slug"]
        addon_dir = os.path.join(PROJECT_ROOT, slug)

        files: dict[str, list[str]] = {}

        def _collect(subdir: str, key: str) -> None:
            path = os.path.join(addon_dir, subdir)
            if not os.path.isdir(path):
                return
            found = []
            for root, dirs, flist in os.walk(path):
                dirs[:] = [d for d in dirs if not d.startswith(".")]
                for f in flist:
                    ext = os.path.splitext(f)[1].lower()
                    if ext in ALLOWED_EXTENSIONS or f in {"Dockerfile", "Makefile"}:
                        rel = os.path.relpath(
                            os.path.join(root, f), PROJECT_ROOT
                        ).replace(os.sep, "/")
                        found.append(rel)
            if found:
                files[key] = sorted(found)

        # Top-level files
        toplevel = []
        for fname in ["config.yaml", "Dockerfile", "run.sh", "build.yaml",
                      "CHANGELOG.md", "README.md", "DOCS.md"]:
            fpath = os.path.join(addon_dir, fname)
            if os.path.isfile(fpath):
                toplevel.append(f"{slug}/{fname}")
        if toplevel:
            files["core"] = toplevel

        _collect("rootfs", "rootfs")
        _collect("translations", "translations")
        _collect("www", "web_assets")
        _collect("admin", "admin_panel")

        connections[slug] = {
            "name": addon["name"],
            "version": addon["version"],
            "description": addon["description"],
            "arch": addon["arch"],
            "image": addon["image"],
            "files": files,
        }

    data = {
        "project": "hassio-addons",
        "description": "Per-addon file connection map for AI agents",
        "timestamp": datetime.datetime.now().isoformat(),
        "connections": connections,
    }

    _write_json(CONNECTIONS_FILE, data, key_exclude="timestamp")
    print(f"  -> {CONNECTIONS_FILE} ({os.path.getsize(CONNECTIONS_FILE):,} bytes)")


# ---------------------------------------------------------------------------
# JSON write (skip if unchanged except timestamp)
# ---------------------------------------------------------------------------


def _write_json(path: str, data: dict, key_exclude: str = "") -> None:
    if os.path.isfile(path):
        try:
            with open(path, "r", encoding="utf-8") as fh:
                existing = json.load(fh)
            existing_cmp = {k: v for k, v in existing.items() if k != key_exclude}
            new_cmp = {k: v for k, v in data.items() if k != key_exclude}
            if existing_cmp == new_cmp:
                print(f"  → {path}: no changes (skipping write).")
                return
        except Exception:
            pass

    with open(path, "w", encoding="utf-8") as fh:
        json.dump(data, fh, indent=2, ensure_ascii=False)


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------


if __name__ == "__main__":
    discovered = discover_addons()
    print(f"Found {len(discovered)} addon(s): {[a['slug'] for a in discovered]}")
    generate_manifest(discovered)
    generate_connections(discovered)
    print("Done.")
