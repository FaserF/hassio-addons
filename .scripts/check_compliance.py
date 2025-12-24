import os
import sys

def check_addon(addon_path):
    dockerfile_path = os.path.join(addon_path, "Dockerfile")
    config_path = os.path.join(addon_path, "config.yaml") # or json

    if not os.path.exists(dockerfile_path):
        print(f"❌ {addon_path}: Dockerfile missing")
        return False

    with open(dockerfile_path, 'r') as f:
        content = f.read()

    errors = []

    # Check 1: S6 Overlay
    # Simple heuristic: Look for S6 related env vars or copying s6-overlay files
    if "S6_" not in content and "s6-overlay" not in content:
        errors.append("Missing S6 Overlay (init system)")

    # Check 2: Healthcheck
    if "HEALTHCHECK" not in content:
        errors.append("Missing HEALTHCHECK instruction")

    # Check 3: OCI Labels
    if "org.opencontainers.image.title" not in content or \
       "org.opencontainers.image.description" not in content:
        errors.append("Missing OCI Labels (org.opencontainers.image...)")

    if errors:
        print(f"❌ {addon_path} Failed Compliance:")
        for err in errors:
            print(f"   - {err}")
        return False

    print(f"✅ {addon_path} passed compliance checks.")
    return True

def main():
    if len(sys.argv) < 2:
        print("Usage: python check_compliance.py <addon_dir> [addon_dir2 ...]")
        sys.exit(1)

    failed = False
    for addon in sys.argv[1:]:
        if not check_addon(addon):
            failed = True

    if failed:
        sys.exit(1)

if __name__ == "__main__":
    main()
