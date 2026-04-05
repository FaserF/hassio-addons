#!/usr/bin/env python3
import os
import sys
from pathlib import Path


def patch_file(file_path: Path, search_text: str, insertion_text: str, after: bool = True):
    if not file_path.exists():
        print(f"Skipping patch: {file_path} not found")
        return

    content = file_path.read_text()
    if insertion_text in content:
        print(f"Patch already applied to {file_path.name}")
        return

    if search_text in content:
        print(f"Applying patch to {file_path.name}...")
        if after:
            new_content = content.replace(search_text, search_text + "\n" + insertion_text)
        else:
            new_content = content.replace(search_text, insertion_text + "\n" + search_text)
        file_path.write_text(new_content)
        print(f"Successfully patched {file_path.name}")
    else:
        print(f"Warning: Could not find target pattern '{search_text}' in {file_path.name}")


def main():
    app_dir = Path("/app/src/switchcraft/server")
    if not app_dir.exists():
        print(f"Error: {app_dir} does not exist.")
        sys.exit(1)

    # 1. Patch app.py (get_current_user)
    app_py = app_dir / "app.py"
    # We insert our bypass at the start of the function body
    get_user_search = "def get_current_user(request: Request):"
    get_user_bypass = """    # --- Home Assistant Ingress/Env Bypass ---
    if os.environ.get(\"SWITCHCRAFT_AUTH_DISABLED\", \"\").lower() == \"true\":
        return \"admin\"
    if request.headers.get(\"x-hass-source\") == \"Home Assistant\" or request.headers.get(\"x-ingress-name\"):
        return \"admin\"
    # -----------------------------------------"""
    
    patch_file(app_py, get_user_search, get_user_bypass, after=True)

    # 2. Patch auth_config.py (load_config)
    auth_config_py = app_dir / "auth_config.py"
    # We insert our force-disable logic inside load_config where data is processed
    load_config_search = "if \"session_cookie_secure\" not in data:"
    load_config_bypass = """                # Force disable auth via Env (HA Addon)
                if os.environ.get(\"SWITCHCRAFT_AUTH_DISABLED\", \"\").lower() == \"true\":
                    data[\"auth_disabled\"] = True"""

    patch_file(auth_config_py, load_config_search, load_config_bypass, after=True)


if __name__ == "__main__":
    main()
