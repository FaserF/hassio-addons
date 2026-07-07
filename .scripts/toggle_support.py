import argparse
import os
import re
import shutil
import subprocess

ROOT_DIR = "."
UNSUPPORTED_DIR = ".unsupported"
README_PATH = "README.md"


def update_readme_status(addon, to_unsupported, reason="deprecated by vendor"):
    if not os.path.exists(README_PATH):
        print(f"[WARN] {README_PATH} not found.")
        return

    with open(README_PATH, "r", encoding="utf-8") as f:
        lines = f.readlines()

    new_lines = []
    updated = False
    for line in lines:
        # Look for the row representing this addon
        if f"({addon})" in line or f"({UNSUPPORTED_DIR}/{addon})" in line:
            parts = [p.strip() for p in line.split("|")]
            if len(parts) >= 6:
                name_match = re.search(r"\*\*\[([^\]]+)\]\(([^)]+)\)\*\*", parts[1])
                if name_match:
                    name = name_match.group(1)
                    if to_unsupported:
                        parts[1] = f"**[{name}]({UNSUPPORTED_DIR}/{addon})**"
                        # Clean existing reason if any
                        desc = parts[2]
                        if " (" in desc:
                            desc = desc.split(" (")[0]
                        parts[2] = f"{desc} ({reason})"
                        parts[3] = "❌"
                    else:
                        parts[1] = f"**[{name}]({addon})**"
                        # Remove reason from description
                        desc = parts[2]
                        if " (" in desc:
                            desc = desc.split(" (")[0]
                        parts[2] = desc
                        # Set default status based on version
                        status = "✅"
                        config_path = os.path.join(addon, "config.yaml")
                        if os.path.exists(config_path):
                            with open(config_path, "r", encoding="utf-8") as cf:
                                for cl in cf:
                                    if cl.strip().startswith("version:"):
                                        ver = cl.split(":", 1)[1].strip().strip("'\"")
                                        if ver.startswith("0."):
                                            status = "⚠️"
                                        break
                        parts[3] = status

                    line = f"| {parts[1]} | {parts[2]} | {parts[3]} | {parts[4]} |\n"
                    updated = True
        new_lines.append(line)

    with open(README_PATH, "w", encoding="utf-8", newline="\n") as f:
        f.writelines(new_lines)
    if updated:
        print("[INFO] README table updated successfully.")
    else:
        print("[WARN] Could not find addon in README table.")


def update_config_yaml(addon, to_unsupported):
    addon_dir = os.path.join(UNSUPPORTED_DIR if to_unsupported else ROOT_DIR, addon)
    config_path = os.path.join(addon_dir, "config.yaml")
    if not os.path.exists(config_path):
        print(f"[WARN] {config_path} not found.")
        return

    with open(config_path, "r", encoding="utf-8") as f:
        content = f.read()

    # Update URL
    if to_unsupported:
        content = re.sub(
            r"url:\s*https://github\.com/FaserF/hassio-addons/tree/master/(" + re.escape(addon) + r")",
            f"url: https://github.com/FaserF/hassio-addons/tree/master/{UNSUPPORTED_DIR}/{addon}",
            content,
        )
        # Update stage to deprecated
        if "stage:" in content:
            content = re.sub(r"stage:\s*\w+", "stage: deprecated", content)
        else:
            if "options:" in content:
                content = content.replace("options:", "stage: deprecated\noptions:")
            else:
                if not content.endswith("\n"):
                    content += "\n"
                content += "stage: deprecated\n"
    else:
        content = re.sub(
            r"url:\s*https://github\.com/FaserF/hassio-addons/tree/master/"
            + re.escape(UNSUPPORTED_DIR)
            + r"/("
            + re.escape(addon)
            + r")",
            f"url: https://github.com/FaserF/hassio-addons/tree/master/{addon}",
            content,
        )
        # Reset stage depending on version
        version = "0.1.0"
        for line in content.splitlines():
            if line.strip().startswith("version:"):
                version = line.split(":", 1)[1].strip().strip("'\"")
                break

        is_experimental = version.startswith("0.")
        if is_experimental:
            if "stage:" in content:
                content = re.sub(r"stage:\s*\w+", "stage: experimental", content)
            else:
                if "options:" in content:
                    content = content.replace("options:", "stage: experimental\noptions:")
                else:
                    if not content.endswith("\n"):
                        content += "\n"
                    content += "stage: experimental\n"
        else:
            # stable, remove stage
            content = re.sub(r"\nstage:\s*\w+", "", content)

    with open(config_path, "w", encoding="utf-8", newline="\n") as f:
        f.write(content)
    print("[INFO] config.yaml updated.")


def prune_images(addon):
    print(f"[INFO] Pruning Docker images for {addon} (Keeping 1)...")
    token = os.environ.get("GITHUB_TOKEN")
    owner = os.environ.get("GITHUB_REPOSITORY_OWNER")

    if not token or not owner:
        print("[WARN] Missing GITHUB_TOKEN or OWNER. Skipping prune.")
        return

    import requests

    headers = {
        "Authorization": f"Bearer {token}",
        "Accept": "application/vnd.github.v3+json",
    }

    packages_to_check = [addon, f"addon-{addon}"]

    for pkg in packages_to_check:
        url = f"https://api.github.com/orgs/{owner}/packages/container/{pkg}/versions"
        res = requests.get(url, headers=headers)
        if res.status_code == 404:
            url = f"https://api.github.com/users/{owner}/packages/container/{pkg}/versions"
            res = requests.get(url, headers=headers)

        if res.status_code != 200:
            continue

        versions = res.json()
        if not versions:
            continue

        versions.sort(key=lambda x: x["updated_at"], reverse=True)
        to_delete = versions[1:]

        for v in to_delete:
            vid = v["id"]
            print(f"   - Deleting version {vid} of {pkg}")
            requests.delete(f"{url}/{vid}", headers=headers)


def toggle_support(addon, action, reason="deprecated by vendor"):
    target_state_unsupported = action == "unsupported"

    if target_state_unsupported:
        src = os.path.join(ROOT_DIR, addon)
        dst = os.path.join(UNSUPPORTED_DIR, addon)
        if not os.path.exists(src):
            if os.path.exists(dst):
                print(f"[INFO] {addon} is already in {UNSUPPORTED_DIR}.")
                update_readme_status(addon, to_unsupported=True, reason=reason)
                update_config_yaml(addon, to_unsupported=True)
                return
            else:
                print(f"[ERROR] Add-on {addon} not found in root.")
                return

        print(f"[INFO] Moving {addon} to {UNSUPPORTED_DIR}...")
        if not os.path.exists(UNSUPPORTED_DIR):
            os.makedirs(UNSUPPORTED_DIR)
        shutil.move(src, dst)

        update_readme_status(addon, to_unsupported=True, reason=reason)
        update_config_yaml(addon, to_unsupported=True)
        prune_images(addon)

    else:
        src = os.path.join(UNSUPPORTED_DIR, addon)
        dst = os.path.join(ROOT_DIR, addon)
        if not os.path.exists(src):
            if os.path.exists(dst):
                print(f"[INFO] {addon} is already supported (in root).")
                update_readme_status(addon, to_unsupported=False)
                update_config_yaml(addon, to_unsupported=False)
                return
            else:
                print(f"[ERROR] Add-on {addon} not found in {UNSUPPORTED_DIR}.")
                return

        print(f"[INFO] Moving {addon} to root (Resurrecting)...")
        shutil.move(src, dst)

        update_readme_status(addon, to_unsupported=False)
        update_config_yaml(addon, to_unsupported=False)

    # Regenerate manifest
    print("[INFO] Regenerating project manifest...")
    subprocess.run(["python", ".scripts/generate_manifest.py"], check=True)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("addon", help="Add-on slug")
    parser.add_argument("action", choices=["supported", "unsupported"], help="Target state")
    parser.add_argument("--reason", default="deprecated by vendor", help="Reason for unsupporting")
    args = parser.parse_args()

    toggle_support(args.addon, args.action, args.reason)
