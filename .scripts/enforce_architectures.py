import json
import os
from pathlib import Path

import yaml

UNSUPPORTED_ARCHES = ["armhf", "armv7", "i386"]


def enforce_config(file_path):
    with open(file_path, "r", encoding="utf-8") as f:
        try:
            content = yaml.safe_load(f)
        except yaml.YAMLError:
            return False

    if not isinstance(content, dict) or "arch" not in content:
        return False

    original_arch = content["arch"]
    if not isinstance(original_arch, list):
        return False

    new_arch = [a for a in original_arch if a not in UNSUPPORTED_ARCHES]

    if len(original_arch) != len(new_arch):
        content["arch"] = new_arch
        with open(file_path, "w", encoding="utf-8") as f:
            yaml.dump(content, f, sort_keys=False, default_flow_style=False)
        return True
    return False


def enforce_build(file_path):
    if file_path.suffix == ".yaml":
        with open(file_path, "r", encoding="utf-8") as f:
            try:
                content = yaml.safe_load(f)
            except yaml.YAMLError:
                return False
    elif file_path.suffix == ".json":
        with open(file_path, "r", encoding="utf-8") as f:
            try:
                content = json.load(f)
            except json.JSONDecodeError:
                return False
    else:
        return False

    if not isinstance(content, dict) or "build_from" not in content:
        return False

    modified = False
    build_from = content["build_from"]

    if not isinstance(build_from, dict):
        return False

    keys_to_remove = [k for k in build_from.keys() if k in UNSUPPORTED_ARCHES]
    if keys_to_remove:
        for k in keys_to_remove:
            del build_from[k]
        modified = True

    if modified:
        if file_path.suffix == ".yaml":
            with open(file_path, "w", encoding="utf-8") as f:
                yaml.dump(content, f, sort_keys=False, default_flow_style=False)
        else:
            with open(file_path, "w", encoding="utf-8") as f:
                json.dump(content, f, indent=2)
        return True
    return False


def main():
    try:
        modified_addons = set()
        root_dir = Path(".")

        for addon_dir in root_dir.iterdir():
            if not addon_dir.is_dir() or addon_dir.name.startswith("."):
                continue

            config_file = addon_dir / "config.yaml"
            if config_file.exists():
                if enforce_config(config_file):
                    modified_addons.add(addon_dir.name)

            build_yaml = addon_dir / "build.yaml"
            if build_yaml.exists():
                if enforce_build(build_yaml):
                    modified_addons.add(addon_dir.name)

            build_json = addon_dir / "build.json"
            if build_json.exists():
                if enforce_build(build_json):
                    modified_addons.add(addon_dir.name)

        github_output = os.environ.get("GITHUB_OUTPUT")
        if github_output:
            with open(github_output, "a", encoding="utf-8") as f:
                if modified_addons:
                    f.write("modified=true\n")
                    f.write(f'addons={",".join(sorted(modified_addons))}\n')
                else:
                    f.write("modified=false\n")

        if modified_addons:
            print("Modified 32-bit architectures in the following addons:")
            for addon in sorted(modified_addons):
                print(f"- {addon}")

    except Exception as e:
        import traceback
        traceback.print_exc()
        print(f"Error in enforce_architectures.py: {e}")
        # Ensure downstream steps don't fail due to missing output
        github_output = os.environ.get("GITHUB_OUTPUT")
        if github_output:
            with open(github_output, "a", encoding="utf-8") as f:
                f.write("modified=false\n")
        # Exit 0 so the workflow continues (as requested for robustness)
        exit(0)

if __name__ == "__main__":
    main()
