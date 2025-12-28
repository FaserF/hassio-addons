import os
import shutil

SOURCE_LIB = os.path.join(".scripts", "bashio", "banner.sh")

def get_addons():
    addons = []
    for item in os.listdir("."):
        if (
            os.path.isdir(item)
            and not item.startswith(".")
            and os.path.exists(os.path.join(item, "config.yaml"))
        ):
            addons.append(item)
    return addons

def sync_lib():
    if not os.path.exists(SOURCE_LIB):
        print(f"❌ Source library not found at {SOURCE_LIB}")
        return

    addons = get_addons()
    print(f"🔄 Syncing {SOURCE_LIB} to {len(addons)} add-ons...")

    for addon in addons:
        # Determine target directory
        # Most addons have rootfs/
        target_dir = os.path.join(addon, "rootfs", "usr", "lib", "bashio")

        # Exception: netboot-xyz uses root/ instead of rootfs/
        if addon == "netboot-xyz":
            target_dir = os.path.join(addon, "root", "usr", "lib", "bashio")
        elif os.path.exists(os.path.join(addon, "rootfs")):
            target_dir = os.path.join(addon, "rootfs", "usr", "lib", "bashio")
        else:
            print(f"  ⏭️ {addon} -> skipped (no rootfs/root directory)")
            continue

        if not os.path.exists(target_dir):
            os.makedirs(target_dir, exist_ok=True)

        target_path = os.path.join(target_dir, "banner.sh")
        shutil.copy2(SOURCE_LIB, target_path)
        print(f"  ✅ {addon} -> {target_path}")

if __name__ == "__main__":
    sync_lib()
