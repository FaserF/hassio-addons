import os

import yaml

# Constants
UNSUPPORTED_BANNER = """
> [!CAUTION]
> **UNSUPPORTED ADD-ON**
>
> This add-on is currently **UNSUPPORTED**.
> It is no longer actively developed or maintained.
> - No new features will be added.
> - Bugs will likely not be fixed.
> - Automatic workflows (like Base Image updates) may still run, but are not guaranteed.
>
> **USE AT YOUR OWN RISK.**
"""


def add_banner(params):
    path = params["path"]
    readme_path = os.path.join(path, "README.md")
    config_path = os.path.join(path, "config.yaml")

    # 1. Update README
    if os.path.exists(readme_path):
        with open(readme_path, "r", encoding="utf-8") as f:
            content = f.read()

        # Check if banner already exists
        if "**UNSUPPORTED ADD-ON**" not in content:
            print(f"⚠️  Marking {path} as UNSUPPORTED in README...")
            # Insert after Title (first header) or at top
            lines = content.splitlines()
            new_lines = []
            inserted = False
            for line in lines:
                new_lines.append(line)
                if not inserted and line.startswith("# "):
                    new_lines.append(UNSUPPORTED_BANNER.strip())
                    new_lines.append("")  # Spacer
                    inserted = True

            if not inserted:
                # No header found, prepend
                new_lines.insert(0, UNSUPPORTED_BANNER.strip())
                new_lines.insert(1, "")

            with open(readme_path, "w", encoding="utf-8") as f:
                f.write("\n".join(new_lines) + "\n")

    # 2. Update config.yaml description
    if os.path.exists(config_path):
        try:
            with open(config_path, "r", encoding="utf-8") as f:
                config = yaml.safe_load(f)

            # Update description if not present
            desc = config.get("description", "").strip()
            if "(Unsupported)" not in desc:
                config["description"] = f"{desc} (Unsupported)"
                with open(config_path, "w", encoding="utf-8") as f:
                    yaml.dump(
                        config,
                        f,
                        default_flow_style=False,
                        sort_keys=False,
                        allow_unicode=True,
                    )
        except yaml.YAMLError as e:
            print(f"Failed to parse config.yaml: {e}")
        except IOError as e:
            print(f"Failed to update config.yaml: {e}")


def remove_banner(params):
    path = params["path"]
    readme_path = os.path.join(path, "README.md")

    if os.path.exists(readme_path):
        with open(readme_path, "r", encoding="utf-8") as f:
            content = f.read()

        if "[!CAUTION]" in content:
            print(f"✅ Restoring {path} to SUPPORTED status in README...")
            import re

            new_content = re.sub(
                r"\n{3,}", "\n\n", content.replace(UNSUPPORTED_BANNER.strip(), "")
            )

            with open(readme_path, "w", encoding="utf-8") as f:
                f.write(new_content)

    # 2. Update config.yaml description (Remove suffix)
    config_path = os.path.join(path, "config.yaml")
    if os.path.exists(config_path):
        try:
            with open(config_path, "r", encoding="utf-8") as f:
                config = yaml.safe_load(f)

            desc = config.get("description", "")
            if "(Unsupported)" in desc:
                config["description"] = desc.replace(" (Unsupported)", "").strip()
                with open(config_path, "w", encoding="utf-8") as f:
                    yaml.dump(
                        config,
                        f,
                        default_flow_style=False,
                        sort_keys=False,
                        allow_unicode=True,
                    )
        except Exception as e:
            print(f"Failed to restore config.yaml for {path}: {e}")


def main():
    root = "."
    unsupported_dir = ".unsupported"

    # 1. Scan .unsupported folder -> MUST have Banner
    if os.path.exists(unsupported_dir):
        for item in os.listdir(unsupported_dir):
            path = os.path.join(unsupported_dir, item)
            if os.path.isdir(path) and os.path.exists(
                os.path.join(path, "config.yaml")
            ):
                add_banner({"path": path})

    # 2. Scan Root folders -> MUST NOT have Banner
    for item in os.listdir(root):
        if item.startswith("."):
            continue
        path = os.path.join(root, item)
        if os.path.isdir(path) and os.path.exists(os.path.join(path, "config.yaml")):
            remove_banner({"path": path})

    print(f"✅ Processed all add-ons for status updates.")


if __name__ == "__main__":
    main()
