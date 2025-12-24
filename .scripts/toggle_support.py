import os
import shutil
import argparse
import sys
import subprocess

# Re-use prune logic by importing or calling?
# Prune script is standalone. We can call it via subprocess or import main if refactored.
# For simplicity and distinctness, we'll implement specific prune logic here or call the script.

ROOT_DIR = "."
UNSUPPORTED_DIR = "unsupported"
README_PATH = "README.md"

def update_readme_link(addon, to_unsupported):
    if not os.path.exists(README_PATH):
        return

    with open(README_PATH, "r", encoding="utf-8") as f:
        content = f.read()

    # If moving TO unsupported: replace [Name](Slug) with [Name](unsupported/Slug)
    # If moving FROM unsupported: replace [Name](unsupported/Slug) with [Name](Slug)

    if to_unsupported:
        # Pattern: ](addon) -> ](unsupported/addon)
        # We need to be careful about not replacing already unsupported paths if run multiple times,
        # but the script assumes move happens now.
        content = content.replace(f"]({addon})", f"]({UNSUPPORTED_DIR}/{addon})")
        content = content.replace(f"](./{addon})", f"](./{UNSUPPORTED_DIR}/{addon})")
    else:
        # Patern: ](unsupported/addon) -> ](addon)
        content = content.replace(f"]({UNSUPPORTED_DIR}/{addon})", f"]({addon})")
        content = content.replace(f"](./{UNSUPPORTED_DIR}/{addon})", f"](./{addon})")

    with open(README_PATH, "w", encoding="utf-8") as f:
        f.write(content)
    print("✅ README links updated.")

def prune_images(addon):
    print(f"🗑️ Pruning Docker images for {addon} (Keeping 1)...")
    # We call the prune_registry.py script but we need to modify it or pass args.
    # Since prune_registry creates a list of ALL packages, it might be slow for just one.
    # But for now, let's try to invoke it if it supports args, or just implement specific logic here.
    # The current prune_registry.py scans ALL.
    # Let's write a targeted deletion here using the same env vars.

    token = os.environ.get("GITHUB_TOKEN")
    owner = os.environ.get("GITHUB_REPOSITORY_OWNER")

    if not token or not owner:
        print("⚠️ Missing GITHUB_TOKEN or OWNER. Skipping prune.")
        return

    import requests
    headers = {"Authorization": f"Bearer {token}", "Accept": "application/vnd.github.v3+json"}

    # We need to handle package name variations (addon-slug, slug, etc).
    # We'll guess `addon` and `addon-{addon}`.
    packages_to_check = [addon, f"addon-{addon}"]

    for pkg in packages_to_check:
        # Get versions
        url = f"https://api.github.com/orgs/{owner}/packages/container/{pkg}/versions"
         # Fallback to user
        res = requests.get(url, headers=headers)
        if res.status_code == 404:
             url = f"https://api.github.com/users/{owner}/packages/container/{pkg}/versions"
             res = requests.get(url, headers=headers)

        if res.status_code != 200:
            continue

        versions = res.json()
        if not versions:
            continue

        # Sort by updated_at desc
        versions.sort(key=lambda x: x['updated_at'], reverse=True)

        # Keep 1 (latest usually)
        # Logic: If unsupported, maybe user wants to keep NO images?
        # User said: "delete all Docker Images except the newest".
        to_keep = versions[:1]
        to_delete = versions[1:]

        for v in to_delete:
            vid = v['id']
            print(f"   - Deleting version {vid} of {pkg}")
            # Delete
            del_url = f"{url}/{vid}" # this url base is .../versions, so + /id works? No, url var was set to base.
            # actually we constructed url above.
            # verify url construction
            requests.delete(f"{url}/{vid}", headers=headers)

def toggle_support(addon, action):
    target_state_unsupported = (action == "unsupported")

    if target_state_unsupported:
        src = os.path.join(ROOT_DIR, addon)
        dst = os.path.join(UNSUPPORTED_DIR, addon)
        if not os.path.exists(src):
            if os.path.exists(dst):
                print(f"ℹ️ {addon} is already in {UNSUPPORTED_DIR}.")
                return
            else:
                print(f"❌ Add-on {addon} not found in root.")
                return

        print(f"🚚 Moving {addon} to {UNSUPPORTED_DIR}...")
        if not os.path.exists(UNSUPPORTED_DIR):
            os.makedirs(UNSUPPORTED_DIR)
        shutil.move(src, dst)

        update_readme_link(addon, to_unsupported=True)
        prune_images(addon)

    else:
        # Make supported
        src = os.path.join(UNSUPPORTED_DIR, addon)
        dst = os.path.join(ROOT_DIR, addon)
        if not os.path.exists(src):
             if os.path.exists(dst):
                 print(f"ℹ️ {addon} is already supported (in root).")
                 return
             else:
                 print(f"❌ Add-on {addon} not found in {UNSUPPORTED_DIR}.")
                 return

        print(f"🚚 Moving {addon} to root (Resurrecting)...")
        shutil.move(src, dst)

        update_readme_link(addon, to_unsupported=False)
        # No prune needed when supporting.

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("addon", help="Add-on slug")
    parser.add_argument("action", choices=["supported", "unsupported"], help="Target state")
    args = parser.parse_args()

    toggle_support(args.addon, args.action)
