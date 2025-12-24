import os
import yaml
import re


ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
README_PATH = os.path.join(ROOT_DIR, "README.md")

def get_config_info(addon_path):
    config_path = os.path.join(addon_path, "config.yaml")
    if not os.path.exists(config_path):
        return None
    try:
        with open(config_path, "r") as f:
            return yaml.safe_load(f)
    except:
        return None

def detect_new_addons(fix=False):
    if not os.path.exists(README_PATH):
        print("❌ README.md not found.")
        return []

    with open(README_PATH, "r", encoding="utf-8") as f:
        readme_content = f.read()

    # Get all potential add-on dirs
    all_dirs = [d for d in os.listdir(".") if os.path.isdir(d) and not d.startswith(".") and os.path.exists(os.path.join(d, "config.yaml"))]

    # Filter known ones
    # Heuristic: If "[<dir>]" or "] (<dir>)" is in README.
    # We use a set of "mentioned slugs"
    new_addons = []

    for d in all_dirs:
        # Check if linked
        if f"]({d})" not in readme_content and f"](./{d})" not in readme_content:
             print(f"🆕 Detected new add-on: {d}")
             new_addons.append(d)

    if not new_addons:
        print("✅ No new add-ons detected.")
        return []

    if fix:
        print("🔧 Remediating README.md...")
        # Find the table. Assuming a standard markdown table.
        # We append to the end of the table or a generic list.
        # Find last pipe '|' line?
        lines = readme_content.splitlines()
        table_end_idx = -1

        # This is fragile without a defined marker, but we try to find the Add-ons table.
        # Look for header | Name | Description | ...
        # Then scroll until non-table line.

        in_table = False
        last_table_line = -1

        for i, line in enumerate(lines):
            if "| Name |" in line or "| Addon |" in line:
                in_table = True
            if in_table:
                if line.strip().startswith("|"):
                    last_table_line = i
                else:
                    if last_table_line > -1:
                        # End of table
                        break

        if last_table_line > -1:
            for addon in new_addons:
                conf = get_config_info(addon)
                name = conf.get("name", addon) if conf else addon
                desc = conf.get("description", "No description") if conf else "No description"
                # Construct row
                # | [Name](slug) | Description |
                row = f"| [{name}]({addon}) | {desc} |"
                lines.insert(last_table_line + 1, row)
                last_table_line += 1 # shift

            with open(README_PATH, "w", encoding="utf-8") as f:
                f.write("\n".join(lines))
            print("✅ README.md updated.")
        else:
             print("⚠️ Could not find Add-ons table in README.md. Appending list.")
             with open(README_PATH, "a", encoding="utf-8") as f:
                 f.write("\n\n## New Add-ons\n")
                 for addon in new_addons:
                     f.write(f"- [{addon}]({addon})\n")

    return new_addons

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--fix", action="store_true", help="Add to README")
    args = parser.parse_args()

    print(detect_new_addons(fix=args.fix))
