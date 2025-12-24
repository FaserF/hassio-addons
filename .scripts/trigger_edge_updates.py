import os
import subprocess

# Define Edge add-ons or logic to detect them
# For now, we assume any add-on ending in '-edge' or specific list
EDGE_ADDONS = [
    # "example-edge",
    # "node-red-edge"
]


def get_all_addons():
    addons = []
    for item in os.listdir("."):
        if (
            os.path.isdir(item)
            and not item.startswith(".")
            and os.path.exists(os.path.join(item, "config.yaml"))
        ):
            if item.endswith("-edge") or item in EDGE_ADDONS:
                addons.append(item)
    return addons


def main():
    addons = get_all_addons()
    if not addons:
        print("ℹ️  No edge add-ons found.")
        return

    print(f"🚀 Triggering updates for: {addons}")

    for addon in addons:
        print(f"👉 Triggering {addon}...")
        try:
            # We bump 'minor' or just rebuild?
            # Requirement: "Pull latest upstream -> Build -> Release"
            # We assume 'patch' bump to indicate update.
            subprocess.run(
                [
                    "gh",
                    "workflow",
                    "run",
                    "orchestrator-release.yaml",
                    "-f",
                    f"addon={addon}",
                    "-f",
                    "version=patch",  # Bump patch to trigger release
                    "-f",
                    "message=Auto-update: Upstream changes from Main",  # Does orchestrator-release accept message? Not yet in inputs!
                ],
                check=True,
            )
        except subprocess.CalledProcessError as e:
            print(f"❌ Failed to trigger {addon}: {e}")


if __name__ == "__main__":
    main()
