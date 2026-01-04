import json
import os
import sys


def fix_config(path):
    try:
        with open(path, "r") as f:
            content = f.readlines()
    except (OSError, IOError) as e:
        print(f"Error reading {path}: {e}")
        return

    new_content = []
    changed = False

    for line in content:
        stripped = line.strip()

        # Remove deprecated keys if they are causing linter errors (usually defaults)
        # Note: We are removing lines purely based on key presence as requested by linter
        if (
            stripped.startswith("startup:")
            or stripped.startswith("boot:")
            or stripped.startswith("ingress_port:")
        ):
            print(f"Removing deprecated line in {path}: {stripped}")
            changed = True
            continue

        # Exception: Netboot requires full_access for functionality (user request)
        if stripped.startswith("full_access:") and "netboot" not in path:
            print(f"Removing deprecated line in {path}: {stripped}")
            changed = True
            continue

        if stripped == "ingress: false":
            print(f"Removing redundant ingress line in {path}")
            changed = True
            continue

        # Fix Map config -> homeassistant_config
        if "- config:rw" in line:
            print(f"Updating map config in {path}")
            line = line.replace("config:rw", "homeassistant_config:rw")
            changed = True

        # Remove empty options/schema if causing issues?
        # User log: "'options' should be removed, it uses a default value" (homeassistant-test-instance)
        # We will strip them if they appear empty "options: {}"
        if stripped == "options: {}" or stripped == "schema: {}":
            print(f"Removing empty options/schema in {path}")
            changed = True
            continue

        new_content.append(line)

    if changed:
        try:
            with open(path, "w") as f:
                f.writelines(new_content)
        except (OSError, IOError) as e:
            print(f"Error writing {path}: {e}")


def fix_build_json(path):
    """Remove empty 'args' objects from build.json files using proper JSON parsing."""
    try:
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
    except (OSError, IOError) as e:
        print(f"Error reading {path}: {e}")
        return
    except json.JSONDecodeError as e:
        print(f"Error parsing JSON in {path}: {e}")
        return

    # Remove empty 'args' key if present
    changed = False
    if "args" in data and data["args"] == {}:
        print(f"Removing empty args in {path}")
        del data["args"]
        changed = True

    if changed:
        try:
            with open(path, "w", encoding="utf-8") as f:
                json.dump(data, f, indent=2)
                f.write("\n")  # Add trailing newline
        except (OSError, IOError) as e:
            print(f"Error writing {path}: {e}")


SKIP_DIRS = {
    ".git",
    "node_modules",
    ".vscode",
    "dist",
    "build",
    "coverage",
    ".venv",
    "env",
    "tmp",
}


def main():
    targets = sys.argv[1:] if len(sys.argv) > 1 else ["."]

    for target in targets:
        if os.path.isfile(target):
            if target.endswith("config.yaml"):
                fix_config(target)
            if target.endswith("build.json"):
                fix_build_json(target)
        elif os.path.isdir(target):
            for root, dirs, files in os.walk(target):
                dirs[:] = [d for d in dirs if d not in SKIP_DIRS]

                if "config.yaml" in files:
                    fix_config(os.path.join(root, "config.yaml"))
                if "build.json" in files:
                    fix_build_json(os.path.join(root, "build.json"))


if __name__ == "__main__":
    main()
