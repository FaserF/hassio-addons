import os
import sys

import requests

# Configuration
ORG_NAME = os.environ.get("GITHUB_REPOSITORY_OWNER")
TOKEN = os.environ.get("GITHUB_TOKEN")

# Retention settings
KEEP_VERSIONS_SUPPORTED = 2  # Keep 2 versions for supported addons
KEEP_VERSIONS_UNSUPPORTED = 1  # Keep only 1 version for unsupported addons


if not ORG_NAME or not TOKEN:
    print("❌ Error: GITHUB_REPOSITORY_OWNER and GITHUB_TOKEN must be set.")
    print(f"   ORG_NAME: {ORG_NAME if ORG_NAME else 'NOT SET'}")
    print(f"   TOKEN: {'SET' if TOKEN else 'NOT SET'}")
    sys.exit(1)

print(f"🔧 Configuration:")
print(f"   ORG_NAME: {ORG_NAME}")
print(f"   TOKEN: {'SET' if TOKEN else 'NOT SET'}")
print()

HEADERS = {
    "Authorization": f"Bearer {TOKEN}",
    "Accept": "application/vnd.github.v3+json",
}


def is_unsupported_addon(package_name):
    """Check if this package is an unsupported addon."""
    # 1. Check against filesystem structure (source of truth)
    unsupported_dir = ".unsupported"
    if os.path.exists(unsupported_dir):
        # Scan local .unsupported directory
        if package_name in os.listdir(unsupported_dir):
            return True

    # 2. Check for .unsupported in path (if package_name implies path? No, package_name is just the name)
    # But we can try to find where it is locally
    # If the package_name exists in .unsupported/, we already caught it.

    return False


def get_packages(package_type="container"):
    """Get all packages with pagination support."""
    all_packages = []
    page = 1
    per_page = 100
    
    # Try org endpoint first
    base_url = f"https://api.github.com/orgs/{ORG_NAME}/packages"
    print(f"🔍 Fetching packages from: orgs/{ORG_NAME}")
    
    while True:
        url = f"{base_url}?package_type={package_type}&per_page={per_page}&page={page}"
        try:
            res = requests.get(url, headers=HEADERS)
            print(f"   Page {page} - Response status: {res.status_code}")
        except requests.RequestException as e:
            print(f"❌ API Request Failed: {e}")
            break

        if res.status_code == 404:
            # Try user endpoint if org fails
            if page == 1:
                print(f"⚠️ Org endpoint failed, trying user endpoint...")
                base_url = f"https://api.github.com/user/packages"
                url = f"{base_url}?package_type={package_type}&per_page={per_page}&page={page}"
                try:
                    res = requests.get(url, headers=HEADERS)
                    print(f"   Page {page} - Response status: {res.status_code}")
                except requests.RequestException as e:
                    print(f"❌ API Request Failed: {e}")
                    break
            else:
                break

        if res.status_code != 200:
            if page == 1:
                print(f"❌ Failed to list packages: {res.status_code} {res.text}")
            break
        
        page_packages = res.json()
        if not page_packages:
            break
        
        all_packages.extend(page_packages)
        
        # Check if there are more pages
        if len(page_packages) < per_page:
            break
        
        page += 1
    
    print(f"   Found {len(all_packages)} package(s) total")
    return all_packages


def get_package_versions(package_name, package_type="container"):
    url = f"https://api.github.com/orgs/{ORG_NAME}/packages/{package_type}/{package_name}/versions"
    try:
        res = requests.get(url, headers=HEADERS)
    except requests.RequestException as e:
        print(f"❌ API Request Failed: {e}")
        return []

    if res.status_code != 200:
        # Try user
        url = f"https://api.github.com/user/packages/{package_type}/{package_name}/versions"
        try:
            res = requests.get(url, headers=HEADERS)
        except requests.RequestException as e:
            print(f"❌ API Request Failed: {e}")
            return []

    if res.status_code != 200:
        print(f"❌ Failed to list versions for {package_name}: {res.status_code}")
        return []
    return res.json()


def delete_version(package_name, version_id, package_type="container"):
    url = f"https://api.github.com/orgs/{ORG_NAME}/packages/{package_type}/{package_name}/versions/{version_id}"
    res = requests.delete(url, headers=HEADERS, timeout=10)
    if res.status_code == 204:
        return True
    else:
        # Try user
        url = f"https://api.github.com/user/packages/{package_type}/{package_name}/versions/{version_id}"
        res = requests.delete(url, headers=HEADERS, timeout=10)
        if res.status_code == 204:
            return True
        else:
            print(
                f"❌ Failed to delete version {version_id} for {package_name}: {res.status_code} {res.text}"
            )
            return False


def is_invalid_package(name):
    """Check if package name is invalid and should be deleted."""
    # Delete packages with "null" name
    if name == "null" or name.lower() == "null":
        return True
    # Delete packages with incorrect "hassio-addons-" prefix
    if name.startswith("hassio-addons-"):
        return True
    return False


def main():
    print(f"🧹 Pruning registry for {ORG_NAME}...")
    print(f"   📦 Supported addons: Keep {KEEP_VERSIONS_SUPPORTED} versions")
    print(f"   🏚️ Unsupported addons: Keep {KEEP_VERSIONS_UNSUPPORTED} version(s)")
    print()

    packages = get_packages()
    
    if not packages:
        print("⚠️ No packages found in registry")
        return
    
    print(f"📦 Found {len(packages)} package(s) in registry")
    print()

    deleted_count = 0
    for pkg in packages:
        name = pkg["name"]

        # Check if this is an invalid package that should be completely deleted
        if is_invalid_package(name):
            print(f"🗑️ Invalid package detected: {name} - deleting all versions...")
            versions = get_package_versions(name)
            if not versions:
                print(f"   ℹ️ No versions found for {name}")
                continue
            for v in versions:
                v_id = v["id"]
                tags = v["metadata"]["container"]["tags"]
                print(f"   🗑️ Deleting {tags} (ID: {v_id})")
                if delete_version(name, v_id):
                    deleted_count += 1
            continue

        is_unsupported = is_unsupported_addon(name)
        keep_versions = (
            KEEP_VERSIONS_UNSUPPORTED if is_unsupported else KEEP_VERSIONS_SUPPORTED
        )
        addon_type = "🏚️ UNSUPPORTED" if is_unsupported else "📦 Supported"

        print(f"👉 {addon_type}: {name} (keep {keep_versions})...")
        versions = get_package_versions(name)
        
        if not versions:
            print(f"   ℹ️ No versions found for {name}")
            continue

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

        if not to_delete:
            print(f"   ✅ No versions to delete for {name}")
        else:
            for v in to_delete:
                v_id = v["id"]
                tags = v["metadata"]["container"]["tags"]
                print(f"   🗑️ Deleting {tags} (ID: {v_id})")
                if delete_version(name, v_id):
                    deleted_count += 1
    
    print()
    print(f"📊 Summary: Deleted {deleted_count} version(s) across {len(packages)} package(s)")


if __name__ == "__main__":
    main()
