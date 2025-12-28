
import os
import re

target_files = [
    r"c:\Users\fseitz\GitHub\hassio-addons\AegisBot\run.sh",
    r"c:\Users\fseitz\GitHub\hassio-addons\ShieldDNS\run.sh",
    r"c:\Users\fseitz\GitHub\hassio-addons\ShieldFile\run.sh",
    r"c:\Users\fseitz\GitHub\hassio-addons\apache2\run.sh",
    r"c:\Users\fseitz\GitHub\hassio-addons\apache2-minimal\rootfs\run.sh",
    r"c:\Users\fseitz\GitHub\hassio-addons\apache2-minimal-mariadb\run.sh",
    r"c:\Users\fseitz\GitHub\hassio-addons\bash_script_executer\run.sh",
    r"c:\Users\fseitz\GitHub\hassio-addons\matterbridge\run.sh",
    r"c:\Users\fseitz\GitHub\hassio-addons\openssl\run.sh",
    r"c:\Users\fseitz\GitHub\hassio-addons\pterodactyl-panel\run.sh",
    r"c:\Users\fseitz\GitHub\hassio-addons\pterodactyl-wings\run.sh",
    r"c:\Users\fseitz\GitHub\hassio-addons\solumati\run.sh",
    r"c:\Users\fseitz\GitHub\hassio-addons\switch_lan_play\run.sh",
    r"c:\Users\fseitz\GitHub\hassio-addons\switch_lan_play_server\run.sh",
    r"c:\Users\fseitz\GitHub\hassio-addons\tado_aa\run.sh",
    r"c:\Users\fseitz\GitHub\hassio-addons\wiki.js\run.sh"
]

# 1. Regex to remove the header block
header_regex = re.compile(
    r"# =+\n#  FaserF's Addon Repository\n#  GitHub: https://github\.com/FaserF/hassio-addons\n# =+\n\n?",
    re.MULTILINE
)

# 2. Regex to remove the else block in version checks
# We look for the elif block ending, then the else block with the specific log line, then fi
# Because regex is tricky with indentation, I will match the exact block I added previously
version_check_block_old = """    # Version Checks
    if [[ "$addon_version" == *"dev"* ]]; then
        bashio::log.warning "⚠️  You are running a Development Build ($addon_version)!"
        bashio::log.warning "⚠️  This version may be unstable and contain bugs."
    elif [[ "$addon_version" =~ ^0\\. ]]; then
         bashio::log.info "🚧  You are running a BETA version ($addon_version)."
    else
         bashio::log.info "✅  Addon Version: $addon_version"
    fi"""

version_check_block_new = """    # Version Checks
    if [[ "$addon_version" == *"dev"* ]]; then
        bashio::log.warning "⚠️  You are running a Development Build ($addon_version)!"
        bashio::log.warning "⚠️  This version may be unstable and contain bugs."
    elif [[ "$addon_version" =~ ^0\\. ]]; then
         bashio::log.info "🚧  You are running a BETA version ($addon_version)."
    fi"""

for file_path in target_files:
    if not os.path.exists(file_path):
        print(f"Skipping {file_path}")
        continue

    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    original_content = content

    # Remove header
    content = header_regex.sub("", content)

    # Update version check block
    # We do a simple string replace because we know exactly what we wrote
    if version_check_block_old in content:
        content = content.replace(version_check_block_old, version_check_block_new)
    else:
        print(f"Warning: Could not find exact version block in {file_path}. Content might be different or already updated.")

    if content != original_content:
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"Refined {file_path}")
    else:
        print(f"No changes for {file_path}")
