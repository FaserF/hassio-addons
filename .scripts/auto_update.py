import os
import subprocess
import argparse
from bump_version import bump_version

def get_changed_files():
    try:
        # Get list of changed files in the last commit
        result = subprocess.check_output(["git", "diff", "--name-only", "HEAD~1", "HEAD"]).decode("utf-8")
        return result.splitlines()
    except subprocess.CalledProcessError:
        print("⚠️ Could not get changed files (shallow clone?)")
        return []

def main():
    changed_files = get_changed_files()
    if not changed_files:
        print("No changed files detected.")
        return

    # Group by directory (add-on)
    changed_addons = set()
    for f in changed_files:
        if "/" in f:
            parts = f.split("/")
            # Assuming add-ons are in root folders or addons/ folder.
            # Based on repo structure, they seem to be in root like "whatsapp", "solumati".
            if parts[0] not in [".github", ".scripts", "unsupported", ".git"]:
                addon = parts[0]
                if os.path.isdir(addon) and os.path.exists(os.path.join(addon, "config.yaml")):
                    changed_addons.add(addon)

    print(f"🔎 Detected potential add-on changes: {list(changed_addons)}")

    for addon in changed_addons:
        print(f"👉 Checking {addon}...")

        # Check if config.yaml was touched
        config_touched = any(f == f"{addon}/config.yaml" for f in changed_files)

        # Check if build-impacting files were touched (Dockerfile, build.yaml)
        build_touched = any(f.startswith(f"{addon}/") and (f.endswith("Dockerfile") or f.endswith("build.yaml")) for f in changed_files)

        if build_touched and not config_touched:
            print(f"🛠️  Code changed but version not bumped. Bumping patch for {addon}...")
            try:
                bump_version(addon, "patch", "Maintenance: Automated dependency/base update")
                # We need to output this for the workflow to know what to release
                with open(os.environ.get('GITHUB_OUTPUT', 'output.txt'), 'a') as f:
                     f.write(f"updated_addon={addon}\n")
            except Exception as e:
                print(f"❌ Failed to bump {addon}: {e}")
        elif config_touched:
             print(f"ℹ️  Version (config.yaml) already changed for {addon}. Assuming manual handling.")
        else:
             print(f"ℹ️  No build-critical changes for {addon}.")

if __name__ == "__main__":
    main()
