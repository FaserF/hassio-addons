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
            # We add a newline BEFORE insertion to keep following code correctly indented
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

    # 1. Patch app.py (get_current_user and Middleware)
    app_py = app_dir / "app.py"
    
    # Bypass logic with logging
    get_user_search = "def get_current_user(request: Request):"
    get_user_bypass = """    # --- Home Assistant Ingress/Env Bypass ---
    if os.environ.get(\"SWITCHCRAFT_AUTH_DISABLED\", \"\").lower() == \"true\":
        print(\"DEBUG: Auth Bypass Triggered (Env)\")
        return \"admin\"
    if request.headers.get(\"x-hass-source\") == \"Home Assistant\" or request.headers.get(\"x-ingress-name\"):
        print(f\"DEBUG: Auth Bypass Triggered (Ingress Headers: {request.headers.get('x-ingress-name')})\")
        return \"admin\"
    # -----------------------------------------"""
    patch_file(app_py, get_user_search, get_user_bypass, after=True)

    # Global Header Logger Middleware (to debug Ingress)
    # Target: app = FastAPI(...)
    middleware_search = "app = FastAPI("
    middleware_code = """
# --- Ingress Debug Middleware ---
@app.middleware(\"http\")
async def log_ingress_headers(request, call_next):
    if \"/api/\" in request.url.path or request.headers.get(\"x-ingress-name\"):
        headers = dict(request.headers)
        # Sanitize sensitive headers
        for h in [\"authorization\", \"cookie\", \"sc_session\"]:
            if h in headers: headers[h] = \"***\"
        print(f\"DEBUG: Incoming {request.method} {request.url.path} | Headers: {headers}\")
    return await call_next(request)
# -------------------------------
"""
    patch_file(app_py, middleware_search, middleware_code, after=True)

    # 2. Patch auth_config.py (load_config)
    auth_config_py = app_dir / "auth_config.py"
    load_config_search = "data = json.load(f)"
    load_config_bypass = """                # Force disable auth via Env (HA Addon)
                if os.environ.get(\"SWITCHCRAFT_AUTH_DISABLED\", \"\").lower() == \"true\":
                    print(\"DEBUG: Forcing auth_disabled=True in config (Env)\")
                    data[\"auth_disabled\"] = True"""

    patch_file(auth_config_py, load_config_search, load_config_bypass, after=True)


if __name__ == "__main__":
    main()
