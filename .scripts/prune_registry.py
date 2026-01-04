import os
import sys

import requests

# Configuration
ORG_NAME = os.environ.get("GITHUB_REPOSITORY_OWNER")
TOKEN = os.environ.get("GITHUB_TOKEN")
DRY_RUN = os.environ.get("DRY_RUN", "false").lower() == "true"

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
    "Accept": "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
}

# GraphQL uses different headers
GRAPHQL_HEADERS = {
    "Authorization": f"Bearer {TOKEN}",
    "Accept": "application/vnd.github+json",
    "Content-Type": "application/json",
}


def is_unsupported_addon(package_name):
    """Check if this package is an unsupported addon."""
    # Package name format: hassio-addons-{slug}-{arch} (e.g., hassio-addons-aegisbot-amd64)
    # Extract slug from package name
    slug = None
    if package_name.startswith("hassio-addons-"):
        # Remove prefix and arch suffix
        slug_part = package_name.replace("hassio-addons-", "")
        # Remove arch suffix (last part after last dash)
        parts = slug_part.rsplit("-", 1)
        if len(parts) == 2:
            slug = parts[0]
        else:
            slug = slug_part
    else:
        # Old format or direct slug
        slug = package_name.split("-")[0]

    if not slug:
        return False

    # 1. Check against filesystem structure (source of truth)
    unsupported_dir = ".unsupported"
    if os.path.exists(unsupported_dir):
        # Scan local .unsupported directory
        if slug in os.listdir(unsupported_dir):
            return True

    return False


def get_packages_via_graphql():
    """Alternative: Use GraphQL API to list packages (workaround for REST API 400 error)."""
    import json

    query = """
    query($org: String!, $packageType: PackageType!, $first: Int!, $after: String) {
      organization(login: $org) {
        packages(first: $first, after: $after, packageType: $packageType) {
          pageInfo {
            hasNextPage
            endCursor
          }
          nodes {
            name
            id
          }
        }
      }
    }
    """

    all_packages = []
    cursor = None
    has_next_page = True

    print(f"🔍 Fetching packages via GraphQL API from: {ORG_NAME}")

    while has_next_page:
        variables = {
            "org": ORG_NAME,
            "packageType": "DOCKER",
            "first": 100,
            "after": cursor,
        }

        try:
            res = requests.post(
                "https://api.github.com/graphql",
                headers=GRAPHQL_HEADERS,
                json={"query": query, "variables": variables},
            )

            if res.status_code != 200:
                print(f"❌ GraphQL request failed: {res.status_code} {res.text}")
                break

            data = res.json()

            if "errors" in data:
                print(f"❌ GraphQL errors: {data['errors']}")
                break

            if "data" not in data or "organization" not in data["data"]:
                print(f"❌ Unexpected GraphQL response structure")
                break

            org_data = data["data"]["organization"]
            if org_data is None:
                print(f"⚠️ Organization '{ORG_NAME}' not found or not accessible")
                break

            packages = org_data.get("packages", {})
            nodes = packages.get("nodes", [])
            page_info = packages.get("pageInfo", {})

            # Convert GraphQL format to REST API format for compatibility
            for node in nodes:
                all_packages.append({"name": node["name"], "id": node["id"]})

            has_next_page = page_info.get("hasNextPage", False)
            cursor = page_info.get("endCursor")

        except requests.RequestException as e:
            print(f"❌ GraphQL API Request Failed: {e}")
            break
        except (KeyError, ValueError) as e:
            print(f"❌ Failed to parse GraphQL response: {e}")
            break

    print(f"   Found {len(all_packages)} package(s) via GraphQL")
    return all_packages


def get_packages(package_type="container"):
    """Get all packages with pagination support."""
    all_packages = []
    page = 1
    per_page = 100
    base_url = None
    use_user_endpoint = False

    # Try org endpoint first
    print(f"🔍 Fetching packages from: orgs/{ORG_NAME}")
    base_url = f"https://api.github.com/orgs/{ORG_NAME}/packages"

    while True:
        url = f"{base_url}?package_type={package_type}&per_page={per_page}&page={page}"
        try:
            res = requests.get(url, headers=HEADERS)
            print(f"   Page {page} - Response status: {res.status_code}")
        except requests.RequestException as e:
            print(f"❌ API Request Failed: {e}")
            break

        if res.status_code == 404:
            # Try user endpoint if org fails (only on first page)
            if page == 1 and not use_user_endpoint:
                print(f"⚠️ Org endpoint failed (404), trying user endpoint...")
                use_user_endpoint = True
                base_url = f"https://api.github.com/user/packages"
                url = f"{base_url}?package_type={package_type}&per_page={per_page}&page={page}"
                try:
                    res = requests.get(url, headers=HEADERS)
                    print(f"   Page {page} - Response status: {res.status_code}")
                except requests.RequestException as e:
                    print(f"❌ API Request Failed: {e}")
                    break
            else:
                # No more pages
                break

        if res.status_code == 400:
            # Bad request - known GitHub API issue with container packages
            error_text = res.text
            print(
                f"⚠️ Bad Request (400) - Known GitHub API issue with container packages"
            )
            print(f"   Trying GraphQL API as workaround...")

            # Try GraphQL API as workaround
            graphql_packages = get_packages_via_graphql()
            if graphql_packages:
                return graphql_packages
            else:
                print(f"❌ GraphQL workaround also failed")
                print(
                    f"   💡 Hint: This is a known GitHub API limitation. Consider using GitHub CLI:"
                )
                print(f"      gh api orgs/{ORG_NAME}/packages?package_type=container")
                break

        if res.status_code == 401:
            print(
                f"❌ Unauthorized (401): Check if GITHUB_TOKEN is valid and has 'read:packages' permission"
            )
            break

        if res.status_code == 403:
            print(f"❌ Forbidden (403): Token may not have 'read:packages' permission")
            print(
                f"   💡 Hint: Ensure the token has 'read:packages' and 'delete:packages' scopes"
            )
            break

        if res.status_code != 200:
            if page == 1:
                print(f"❌ Failed to list packages: {res.status_code} {res.text}")
            break

        try:
            page_packages = res.json()
        except ValueError as e:
            print(f"❌ Failed to parse JSON response: {e}")
            print(f"   Response: {res.text[:200]}")
            break

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
    if DRY_RUN:
        print(f"   [DRY RUN] Would delete version {version_id} for {package_name}")
        return True

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

    # Delete packages that don't follow the correct format: hassio-addons-{slug}-{arch}
    # Valid format: hassio-addons-{slug}-{arch} (e.g., hassio-addons-aegisbot-amd64)
    # Invalid formats to delete:
    # - {slug}-{arch} without hassio-addons- prefix (old format, e.g., aegisbot-amd64)
    # - Packages with unsupported architectures (armhf, armv7, i386) - we only support amd64 and aarch64

    # Check for unsupported architectures (regardless of format)
    parts = name.split("-")
    if len(parts) >= 2:
        last_part = parts[-1].lower()
        # Delete packages with unsupported architectures
        if last_part in ["armhf", "armv7", "i386"]:
            return True

    # Check for old format (without hassio-addons- prefix)
    if not name.startswith("hassio-addons-"):
        # Check if it ends with a supported architecture (old format: slug-arch)
        if len(parts) >= 2:
            last_part = parts[-1].lower()
            # If it ends with a supported architecture, it's the old format and should be deleted
            if last_part in ["amd64", "aarch64"]:
                return True

    return False


def main():
    mode = "🔍 DRY RUN" if DRY_RUN else "🧹 Pruning"
    print(f"{mode} registry for {ORG_NAME}...")
    if DRY_RUN:
        print(f"   ⚠️ DRY RUN MODE: No versions will actually be deleted")
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
    if DRY_RUN:
        print(
            f"📊 Summary: Would delete {deleted_count} version(s) across {len(packages)} package(s)"
        )
        print(f"   ℹ️ Run without DRY_RUN=true to actually delete these versions")
    else:
        print(
            f"📊 Summary: Deleted {deleted_count} version(s) across {len(packages)} package(s)"
        )


if __name__ == "__main__":
    main()
