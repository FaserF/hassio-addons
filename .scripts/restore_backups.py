import os
import shutil

ADDONS = [
    "AegisBot",
    "ShieldDNS",
    "ShieldFile",
    "apache2",
    "apache2-minimal",
    "apache2-minimal-mariadb",
    "bash_script_executer",
    "homeassistant-test-instance",
    "matterbridge",
    "netboot-xyz",
    "openssl",
    "pterodactyl-panel",
    "pterodactyl-wings",
    "solumati",
    "switch_lan_play",
    "switch_lan_play_server",
    "tado_aa",
    "whatsapp",
    "wiki.js",
]

for addon in ADDONS:
    bak_path = os.path.join(addon, "README.md.bak")
    readme_path = os.path.join(addon, "README.md")

    if os.path.exists(bak_path):
        print(f"Restoring {addon}...")
        shutil.copy(bak_path, readme_path)
    else:
        print(f"⚠️ No backup for {addon}")
