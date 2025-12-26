import os
import sys

import requests

# Configuration
ORG_NAME = os.environ.get("GITHUB_REPOSITORY_OWNER")
TOKEN = os.environ.get("GITHUB_TOKEN")

# Retention settings
KEEP_VERSIONS_SUPPORTED = 2      # Keep 2 versions for supported addons
KEEP_VERSIONS_UNSUPPORTED = 1    # Keep only 1 version for unsupported addons

# List of unsupported addon names (detected from .unsupported folder or naming convention)
UNSUPPORTED_ADDONS = [
    "bt-mqtt-gateway",
    "freenom-dns-updater",
    "tuya-convert",
    "xqrepack",
]

if not ORG_NAME or not TOKEN:
    print("❌ Error: GITHUB_REPOSITORY_OWNER and GITHUB_TOKEN must be set.")
    sys.exit(1)

HEADERS = {
    "Authorization": f"Bearer {TOKEN}",
    "Accept": "application/vnd.github.v3+json",
}


def is_unsupported_addon(package_name):
    """Check if this package is an unsupported addon."""
    # Check against known unsupported list
    for unsupported in UNSUPPORTED_ADDONS:
        if unsupported.lower() in package_name.lower():
            return True
    # Also check for naming patterns
    if "unsupported" in package_name.lower():
        return True
    return False


def get_packages(package_type="container"):
    # List packages for organization
    url = f"https://api.github.com/orgs/{ORG_NAME}/packages?package_type={package_type}"
    # If using user account: f"https://api.github.com/user/packages?package_type={package_type}"
    # Assuming Org context based on hassio-addons
    res = requests.get(url, headers=HEADERS)
    if res.status_code != 200:
        # Try user endpoint if org fails
        url = f"https://api.github.com/user/packages?package_type={package_type}"
        res = requests.get(url, headers=HEADERS)

    if res.status_code != 200:
        print(f"❌ Failed to list packages: {res.status_code} {res.text}")
        return []
    return res.json()


def get_package_versions(package_name, package_type="container"):
    url = f"https://api.github.com/orgs/{ORG_NAME}/packages/{package_type}/{package_name}/versions"
    res = requests.get(url, headers=HEADERS)
    if res.status_code != 200:
        # Try user
        url = f"https://api.github.com/user/packages/{package_type}/{package_name}/versions"
        res = requests.get(url, headers=HEADERS)

    if res.status_code != 200:
        print(f"❌ Failed to list versions for {package_name}: {res.status_code}")
        return []
    return res.json()


def delete_version(package_name, version_id, package_type="container"):
    url = f"https://api.github.com/orgs/{ORG_NAME}/packages/{package_type}/{package_name}/versions/{version_id}"
    res = requests.delete(url, headers=HEADERS)
    if res.status_code == 204:
        print(f"✅ Deleted version ID {version_id}")
    else:
        # Try user
        url = f"https://api.github.com/user/packages/{package_type}/{package_name}/versions/{version_id}"
        res = requests.delete(url, headers=HEADERS)
        if res.status_code == 204:
            print(f"✅ Deleted version ID {version_id}")
        else:
            print(
                f"❌ Failed to delete version {version_id}: {res.status_code} {res.text}"
            )


def main():
    print(f"🧹 Pruning registry for {ORG_NAME}...")
    print(f"   📦 Supported addons: Keep {KEEP_VERSIONS_SUPPORTED} versions")
    print(f"   🏚️ Unsupported addons: Keep {KEEP_VERSIONS_UNSUPPORTED} version(s)")

    packages = get_packages()

    for pkg in packages:
        name = pkg["name"]
        is_unsupported = is_unsupported_addon(name)
        keep_versions = KEEP_VERSIONS_UNSUPPORTED if is_unsupported else KEEP_VERSIONS_SUPPORTED
        addon_type = "🏚️ UNSUPPORTED" if is_unsupported else "📦 Supported"

        print(f"👉 {addon_type}: {name} (keep {keep_versions})...")
        versions = get_package_versions(name)

        # Filter versions. Usually sorted by created_at desc.
        # We need to identify 'latest' tag.

        # Sort by updated_at desc just in case
        versions.sort(key=lambda x: x["updated_at"], reverse=True)

        # Keep list
        to_keep = []
        to_delete = []

        count = 0
        for v in versions:
            tags = v["metadata"]["container"]["tags"]
            if "latest" in tags:
                to_keep.append(v)
                continue

            if count < keep_versions:
                to_keep.append(v)
                count += 1
            else:
                to_delete.append(v)

        print(f"   Stats: Keeping {len(to_keep)}, Deleting {len(to_delete)}")

        for v in to_delete:
            v_id = v["id"]
            tags = v["metadata"]["container"]["tags"]
            print(f"   🗑️ Deleting {tags} (ID: {v_id})")
            delete_version(name, v_id)


if __name__ == "__main__":
    main()
