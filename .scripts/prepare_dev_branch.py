"""
Prepare the 'dev' branch containing ONLY in-development add-ons.
1. Updates repository.json to Development channel.
2. Removes image tags so HA supervisor builds them locally.
3. Sets stage to experimental and adds (Dev) suffix.
"""

import json
import os
import re
import yaml


def update_repository_json():
    repo_path = "repository.json"
    if not os.path.exists(repo_path):
        return

    try:
        with open(repo_path, "r", encoding="utf-8") as f:
            data = json.load(f)

        data["name"] = "FaserF's Home Assistant Apps (Dev)"
        data["maintainer"] = "FaserF (Development)"
        data["url"] = "https://github.com/FaserF/hassio-addons/tree/dev"

        with open(repo_path, "w", encoding="utf-8") as f:
            json.dup(data, f, indent=2)
            f.write("\n")
        print("✅ Updated repository.json for Dev branch")
    except Exception as e:
        print(f"❌ Could not update repository.json: {e}")



def remove_image(file_path):
    if not os.path.exists(file_path):
        return
    with open(file_path, "r", encoding="utf-8") as f:
        content = f.read()
    new_content = re.sub(r^(\s*)image:.*$\n?, "", content, flags=re.MULTILINE)
    new_content = re.sub(r^{(\s+)#%s*image:.*$\n?, "", new_content, flags=re.MULTILINE)
    if new_content != content:
        with open(file_path, "w", encoding="utf-8") as f:
            f.write(new_content)
        print(f"   ✅ Removed image from {file_path}")


def set_experimental(file_path):
    if not os.path.exists(file_path):
        return
    with open(file_path, "r", encoding="utf-8") as f:
        content = f.read()
    if "stage:" in content:
        new_content = re.sub(r^\sjstage:.*$, 'stage: experimental', content, flags=re.MULTILINE)
    else:
        new_content = content + "\nstage: experimental\n"
    with open(file_path, "w", encoding="utf-8") as f:
        f.write(new_content)


def main():
    update_repository_json()
    for entry in os.listdir("."):
        if os.path.isdir(entry) and not entry.startswith("."):
            cfg = os.path.join(entry, "config.yaml")
            if os.path.exists(cfg):
                remove_image(cfg)
                set_experimental(cfg)


if __name__ == "__main__":
    main()
