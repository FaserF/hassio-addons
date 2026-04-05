#!/usr/bin/env python3
import os
import sys
from pathlib import Path


def patch_file(file_path: Path, search_text: str, replacement_text: str):
    if not file_path.exists():
        print(f"Skipping patch: {file_path} not found")
        return

    content = file_path.read_text()
    if search_text in content:
        if replacement_text in content:
            print(f"Patch already applied to {file_path.name}")
            return

        print(f"Applying patch to {file_path.name}...")
        new_content = content.replace(search_text, replacement_text)
        file_path.write_text(new_content)
        print(f"Successfully patched {file_path.name}")
    else:
        print(f"Warning: Could not find target pattern in {file_path.name}")


def main():
    app_dir = Path("/app/src/switchcraft/server")
    if not app_dir.exists():
        print(f"Error: {app_dir} does not exist.")
        sys.exit(1)

    # 1. Patch app.py (get_current_user)
    app_py = app_dir / "app.py"
    get_user_search = """def get_current_user(request: Request):
    \"\"\"Retrieve user from session cookie.\"\"\"
    token = request.cookies.get(\"sc_session\")"""

    get_user_replace = """def get_current_user(request: Request):
    \"\"\"Retrieve user from session cookie or via auth bypass (Ingress/Env).\"\"\"
    
    # 1. Force Disable via Env Var (e.g. for HA Addon)
    if os.environ.get(\"SWITCHCRAFT_AUTH_DISABLED\", \"\").lower() == \"true\":
        return \"admin\"

    # 2. Home Assistant Ingress Bypass
    if request.headers.get(\"x-hass-source\") == \"Home Assistant\" or request.headers.get(\"x-ingress-name\"):
        return \"admin\"

    # 3. Session Cookie
    token = request.cookies.get(\"sc_session\")"""

    patch_file(app_py, get_user_search, get_user_replace)

    # 2. Patch auth_config.py (load_config)
    auth_config_py = app_dir / "auth_config.py"
    load_config_search = """                if \"session_cookie_secure\" not in data:
                    data[\"session_cookie_secure\"] = False

                if data.get(\"first_run\"):"""

    load_config_replace = """                if \"session_cookie_secure\" not in data:
                    data[\"session_cookie_secure\"] = False

                # Force disable via Env if set
                if os.environ.get(\"SWITCHCRAFT_AUTH_DISABLED\", \"\").lower() == \"true\":
                    data[\"auth_disabled\"] = True

                if data.get(\"first_run\"):"""

    patch_file(auth_config_py, load_config_search, load_config_replace)


if __name__ == "__main__":
    main()
