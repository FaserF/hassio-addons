import datetime
import os
import sys

import yaml


def generate_labels(addon_path):
    config_path = os.path.join(addon_path, "config.yaml")
    dockerfile_path = os.path.join(addon_path, "Dockerfile")

    if not os.path.exists(config_path) or not os.path.exists(dockerfile_path):
        return False

    try:
        with open(config_path, "r", encoding="utf-8") as f:
            config = yaml.safe_load(f)
    except Exception as e:
        print(f"Failed to read config.yaml in {addon_path}: {e}")
        return False

    name = config.get("name", "Home Assistant Add-on")
    description = config.get("description", "Home Assistant Add-on")
    url = config.get("url", "https://github.com/FaserF/hassio-addons")
    # Note: version could be dynamic but labels are usually static metadata

    # Standard OCI Labels
    labels = {
        "org.opencontainers.image.title": f'"{name}"',
        "org.opencontainers.image.description": f'"{description}"',
        "org.opencontainers.image.vendor": '"FaserF\'s Home Assistant Add-ons"',
        "org.opencontainers.image.authors": '"FaserF <https://github.com/FaserF>"',
        "org.opencontainers.image.licenses": '"MIT"',
        "org.opencontainers.image.url": f'"{url}"',
        "org.opencontainers.image.source": f'"{url}"',
        "org.opencontainers.image.documentation": f'"{url}/blob/master/{os.path.relpath(addon_path, os.getcwd()).replace(os.sep, "/")}/README.md"',
        "org.opencontainers.image.created": '"${BUILD_DATE}"',
    }

    with open(dockerfile_path, "r", encoding="utf-8") as f:
        content = f.read()

    new_content = content

    # Basic check if labels dictate adding
    # We construct the LABEL block
    label_block = []
    for key, value in labels.items():
        if key not in content:
            label_block.append(f"LABEL {key}={value}")

    if label_block:
        print(f"➕ Adding missing OCI labels to {addon_path}/Dockerfile")
        # Append to end, or after FROM?
        # Usually valid anywhere, but after FROM is best.
        # If multiple stages, ideally clearly placed.
        # Simple approach: Append to end if not present.

        # Check if content ends with newline
        if not new_content.endswith("\n"):
            new_content += "\n"

        new_content += "\n# Labels\n" + "\n".join(label_block) + "\n"
        try:
            with open(dockerfile_path, "w", encoding="utf-8") as f:
                f.write(new_content)
            return True
        except Exception as e:
            print(f"Failed to write Dockerfile in {addon_path}: {e}")
            return False

    return False


def main():
    # Helper to find all add-ons
    # Root dirs + .unsupported dirs
    addons = []

    # 1. Root level add-ons
    for item in os.listdir("."):
        if os.path.isdir(item) and not item.startswith("."):
            if os.path.exists(os.path.join(item, "config.yaml")):
                addons.append(item)

    # 2. Unsupported add-ons
    if os.path.exists(".unsupported"):
        for item in os.listdir(".unsupported"):
            path = os.path.join(".unsupported", item)
            if os.path.isdir(path) and os.path.exists(
                os.path.join(path, "config.yaml")
            ):
                addons.append(path)

    changed = False
    for addon in addons:
        if generate_labels(addon):
            changed = True

    if changed:
        print("✅ OCI Labels generated.")
    else:
        print("✨ No OCI Labels needed generation.")


if __name__ == "__main__":
    main()
