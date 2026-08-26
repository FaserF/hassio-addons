"""
Single Source of Truth for Home Assistant Add-ons repository configuration.
Used across CI scripts, documentation generators, and README formatters.
"""

from typing import Set

DEV_ADDONS: Set[str] = {
    "aegisbot",
    "solumati",
    "alivro",
    "antigravity",
    "entramirror",
    "wiki.js3",
    "switchcraft",
    "googlehome",
}

UNSUPPORTED_ADDONS: Set[str] = {
    "bt-mqtt-gateway",
    "freenom-dns-updater",
    "matterbridge",
    "sap-abap-cloud-dev",
    "tuya-convert",
    "xqrepack",
}

BETA_NOTICE = """
> [!CAUTION]
> **Experimental / Beta Status**
>
> This App is still in development and/or primarily developed for personal use.
> It is not extensively tested yet, but is expected to work fundamentally.
"""

DEV_NOTICE = """
> [!CAUTION]
> **In-Development Add-on (Edge Channel Only)**
>
> This add-on is currently in active development and excluded from the stable repository channel.
> While the Home Assistant add-on wrapper itself may be functional, the underlying upstream software is either in an early development stage or hosted within a private repository.
>
> ### 📦 How to Install via Edge Channel
> 1. Click to add the Edge repository:
>    [![Add Edge Repository](https://my.home-assistant.io/badges/supervisor_add_addon_repository.svg)](https://my.home-assistant.io/redirect/supervisor_add_addon_repository/?repository_url=https%3A%2F%2Fgithub.com%2FFaserF%2Fhassio-addons%23edge)
> 2. Or manually add repository in Home Assistant (**Settings** → **Add-ons** → **Add-on Store** → **⋮** → **Repositories**):
>    ```text
>    https://github.com/FaserF/hassio-addons#edge
>    ```
> 3. Refresh the Add-on Store (⋮ → **Check for updates**), find this add-on under **FaserF's Home Assistant Apps (Edge)**, and click **Install**.
"""


def is_dev_addon(name_or_slug: str) -> bool:
    if not name_or_slug:
        return False
    clean = name_or_slug.lower().strip().replace("\\\\", "/").split("/")[-1]
    return clean in DEV_ADDONS


def is_unsupported_addon(name_or_slug: str) -> bool:
    if not name_or_slug:
        return False
    clean = name_or_slug.lower().strip().replace("\\", "/").split("/")[-1]
    return clean in UNSUPPORTED_ADDONS


def check_dev_addons_version_warnings(repo_root: str) -> list[str]:
    """
    Check if any add-on in the DEV_ADDONS blacklist has reached version >= 1.0.0.
    Emits a warning so maintainers can decide whether to unblacklist it.
    """
    import os

    import yaml

    warnings = []
    dirs_to_check = [
        os.path.join(repo_root, ".dev"),
        repo_root,
    ]
    checked = set()
    for base_dir in dirs_to_check:
        if not os.path.exists(base_dir):
            continue
        for item in os.listdir(base_dir):
            clean_item = item.lower()
            if clean_item in checked or not is_dev_addon(clean_item):
                continue
            cfg_path = os.path.join(base_dir, item, "config.yaml")
            if os.path.isfile(cfg_path):
                checked.add(clean_item)
                try:
                    with open(cfg_path, "r", encoding="utf-8") as f:
                        data = yaml.safe_load(f)
                    version_str = str(data.get("version", ""))
                    if version_str:
                        clean_ver = version_str.lstrip("v").split("-")[0].split("+")[0]
                        major = int(clean_ver.split(".")[0])
                        if major >= 1:
                            warnings.append(
                                f"⚠️ [DEV_ADDONS WARNING] Add-on '{item}' reached v{version_str} (>= 1.0.0) but is still blacklisted in DEV_ADDONS / .dev/! Consider unblacklisting and graduating to stable root."
                            )
                except Exception:
                    pass
    return warnings
