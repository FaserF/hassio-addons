import os
import sys

REQUIRED_BADGES = [
    "shields.io/badge/home%20assistant-addon-blue", # Example identification
    "shields.io/github/v/release",
    "shields.io/badge/rating"
]

def check_readme(addon_path):
    readme_path = os.path.join(addon_path, "README.md")
    if not os.path.exists(readme_path):
        print(f"❌ {addon_path}: README.md missing")
        return False

    with open(readme_path, 'r', encoding='utf-8') as f:
        content = f.read()

    errors = []
    # Heuristic check for badges
    # We look for common shield URLs.
    if "img.shields.io" not in content and "shields.io" not in content:
        errors.append("No badges found.")

    # Check specific standard (very basic check)
    if "https://my.home-assistant.io/badges/supervisor_addon.svg" not in content:
         # This is the "Open in HA" badge, crucial.
         errors.append("Missing 'Open in Home Assistant' badge.")

    if errors:
        print(f"❌ {addon_path} README Gaps:")
        for err in errors:
            print(f"   - {err}")
        return False

    print(f"✅ {addon_path} README passed.")
    return True

def main():
    if len(sys.argv) < 2:
        # If no args, scan all
        dirs = [d for d in os.listdir('.') if os.path.isdir(d) and not d.startswith('.')]
    else:
        dirs = sys.argv[1:]

    failed = False
    for d in dirs:
        # Only check if it looks like an addon (has config)
        if os.path.exists(os.path.join(d, "config.yaml")) or os.path.exists(os.path.join(d, "config.json")):
             if not check_readme(d):
                 failed = True

    if failed:
        sys.exit(1)

if __name__ == "__main__":
    main()
