import os
import sys

import requests

# Usage: python retract_version.py <package_name> <version>
# Env: GITHUB_TOKEN (requires delete:packages)

GITHUB_API = "https://api.github.com"


def retract_version(package_name, version, token, owner):
    # ghcr.io/<owner>/<package_name>
    # API: DELETE /users/{username}/packages/{package_type}/{package_name}/versions/{package_version_id}
    # OR /orgs/{org}/packages/...

    # 1. Find the Version ID
    # Note: Package name in GHCR usually matches the add-on slug or config image name.
    # We might need to handle namespacing.

    headers = {
        "Authorization": f"Bearer {token}",
        "Accept": "application/vnd.github.v3+json",
    }

    # Check if User or Org
    # Assuming User 'FaserF' based on context, or Org.
    # We try user first.
    base_url = f"{GITHUB_API}/users/{owner}/packages/container/{package_name}/versions"

    print(f"🔍 Looking for {package_name}:{version} in {owner}'s packages...")

    try:
        resp = requests.get(base_url, headers=headers)
        if resp.status_code == 404:
            # Try Org
            base_url = (
                f"{GITHUB_API}/orgs/{owner}/packages/container/{package_name}/versions"
            )
            resp = requests.get(base_url, headers=headers)

        if resp.status_code != 200:
            print(f"❌ Failed to list versions: {resp.status_code} {resp.text}")
            sys.exit(1)

        versions = resp.json()
        version_id = None

        for v in versions:
            tags = v.get("metadata", {}).get("container", {}).get("tags", [])
            if version in tags:
                version_id = v["id"]
                break

        if not version_id:
            print(f"❌ Version {version} not found for package {package_name}")
            sys.exit(1)

        # 2. Delete
        print(f"🗑️ Found Version ID {version_id}. Deleting...")
        # Construct delete URL (same base usually + /id)
        # /users/{username}/packages/{package_type}/{package_name}/versions/{package_version_id}
        delete_url = f"{base_url}/{version_id}"
        del_resp = requests.delete(delete_url, headers=headers)

        if del_resp.status_code == 204:
            print(f"✅ Successfully retracted {package_name}:{version}")
        else:
            print(f"❌ Failed to delete: {del_resp.status_code} {del_resp.text}")
            sys.exit(1)

    except Exception as e:
        print(f"❌ Error: {e}")
        sys.exit(1)


if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python retract_version.py <addon_slug> <version>")
        sys.exit(1)

    addon = sys.argv[1]
    ver = sys.argv[2]
    token = os.environ.get("GITHUB_TOKEN")
    owner = os.environ.get("GITHUB_REPOSITORY_OWNER")

    if not token or not owner:
        print("❌ GITHUB_TOKEN and GITHUB_REPOSITORY_OWNER env vars required.")
        sys.exit(1)

    # Addon slug might not match package name exactly (e.g. prefix).
    # For Hassio Addons, usually it's `addon-{slug}` or just `{slug}` depending on image config.
    # We assume usage of `addon-{slug}` convention or raw slug if that's the package name.
    # In build steps: image="ghcr.io/${{ github.repository_owner }}/${{ matrix.addon }}" -> Package Name is Addon Slug.
    # BUT sometimes architecture is appended? e.g. `addon-slug-amd64`.
    # To Retract safely, we might need to delete for ALL architectures.

    manifests = [
        f"{addon}-amd64",
        f"{addon}-aarch64",
        f"{addon}-armv7",
        f"{addon}-armhf",
        f"{addon}-i386",
    ]
    # We try the slug itself first (multi-arch manifest) and then arch-specifics?
    # Or just the specific images.

    # Simple approach: Check exact name passed first.
    retract_version(addon, ver, token, owner)

    # If we want to be smart, we could loop variants.
    # retract_version(f"{addon}-amd64", ver, token, owner)
