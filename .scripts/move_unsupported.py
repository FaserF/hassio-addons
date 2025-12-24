import os
import shutil
import json

# Configuration
UNSUPPORTED_ADDONS = [
    "bt-mqtt-gateway",
    "hyperion_ng",
    "HyperionNG",
    "silverstrike",
    "tuya-convert",
    "wiki.js",
    "Wiki.js",
    "freenom-dns-updater"  # Adding based on user context or typical patterns, but will stick strictly to README list if possible.
    # From README: `bt-mqtt-gateway`, `HyperionNG`, `Silverstrike`, `Tuya-Convert`, `Wiki.js`.
]
# Normalize list
UNSUPPORTED_ADDONS = [x.lower() for x in UNSUPPORTED_ADDONS]

ROOT_DIR = "."
TARGET_DIR = "unsupported"

def main():
    if not os.path.exists(TARGET_DIR):
        os.makedirs(TARGET_DIR)
        print(f"Created {TARGET_DIR}")

    moved_count = 0

    # Get all directories in root
    for item in os.listdir(ROOT_DIR):
        item_path = os.path.join(ROOT_DIR, item)

        # Skip if not a directory or is hidden or is the target dir
        if not os.path.isdir(item_path) or item.startswith('.') or item == TARGET_DIR or item == "scripts":
            continue

        # Check if item is in unsupported list
        if item.lower() in UNSUPPORTED_ADDONS:
            target_path = os.path.join(TARGET_DIR, item)

            # Check if already exists
            if os.path.exists(target_path):
                print(f"⚠️  {item} already in {TARGET_DIR}, skipping move.")
            else:
                print(f"🚚 Moving {item} to {TARGET_DIR}...")
                try:
                    shutil.move(item_path, target_path)
                    moved_count += 1
                except Exception as e:
                    print(f"❌ Failed to move {item}: {e}")

    print(f"✅ Process complete. Moved {moved_count} add-ons.")

if __name__ == "__main__":
    main()
