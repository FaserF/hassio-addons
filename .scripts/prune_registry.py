import os
import sys

import requests

# Configuration
ORG_NAME = os.environ.get("GITHUB_REPOSITORY_OWNER")
TOKEN = os.environ.get("GITHUB_TOKEN")
KEEP_VERSIONS = 2

if not ORG_NAME or not TOKEN:
    print("❌ Error: GITHUB_REPOSITORY_OWNER and GITHUB_TOKEN must be set.")
    sys.exit(1)

HEADERS = {
    "Authorization": f"Bearer {TOKEN}",
    "Accept": "application/vnd.github.v3+json",
}


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
    print(f"🧹 Pruning registry for {ORG_NAME} (Keep Latest + {KEEP_VERSIONS})...")
    packages = get_packages()

    for pkg in packages:
        name = pkg["name"]
        print(f"👉 Analyzing {name}...")
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

            if count < KEEP_VERSIONS:
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
