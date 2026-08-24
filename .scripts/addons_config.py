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
[! CAUTION]
> **Experimental / Beta Status**
>
> This App is still in development and/or primarily developed for personal use.
> It is not extensively tested yet, but is expected to work fundamentally.
"""

DEV_NOTICE = """
> [!CAUTION]
> **Development / Edge Channel Only**
>
> This add-on is currently in active development and provided exclusively on the **Edge** branch.
> While the Home Assistant add-on wrapper itself may be functional, the underlying upstream software is either in an early development stage or hosted within a private repository.
>
> 🔐 To test or use this add-on, install the repository via the Edge channel: `https://github.com/FaserF/hassio-addons#edge`
"""


def is_dev_addon(name_or_slug: str) -> bool:
    if not name_or_slug:
        return False
    clean = name_or_slug.lower().strip().replace('\\\\', '/').split('/')[-1]
    return clean in DEV_ADDONS


def is_unsupported_addon(name_or_slug: str) -> bool:
    if not name_or_slug:
        return False
    clean = name_or_slug.lower().strip().replace('\\\\', '/').split('/')[-1]
    return clean in UNSUPPORTED_ADDONS
