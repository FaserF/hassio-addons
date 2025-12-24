import os
import sys
import yaml

def check_addon(addon_path):
    dockerfile_path = os.path.join(addon_path, "Dockerfile")
    build_yaml_path = os.path.join(addon_path, "build.yaml")

    # Files to check
    translations_dir = os.path.join(addon_path, "translations")
    icon_path = os.path.join(addon_path, "icon.png")
    logo_path = os.path.join(addon_path, "logo.png")

    errors = []
    warnings = []

    if not os.path.exists(dockerfile_path):
        errors.append("Dockerfile missing")
        return False, errors, warnings

    with open(dockerfile_path, "r") as f:
        content = f.read()

    # Check 1: S6 Overlay
    if "S6_" not in content and "s6-overlay" not in content and "/usr/bin/with-contenv" not in content:
        # Some add-ons might use base image with pre-configured S6, but it's good practice to be explicit or use standard patterns
        warnings.append("S6 Overlay not explicitly detected (checked for S6_ vars, s6-overlay string, or with-contenv)")

    # Check 2: Healthcheck
    if "HEALTHCHECK" not in content:
        errors.append("Missing HEALTHCHECK instruction in Dockerfile")

    # Check 3: OCI Labels
    if "org.opencontainers.image.title" not in content or "org.opencontainers.image.description" not in content:
         warnings.append("Missing OCI Labels (org.opencontainers.image...)")

    # Check 4: Base Image (Official)
    # Parse FROM instruction or build.yaml
    detected_base = False
    if os.path.exists(build_yaml_path):
        try:
            with open(build_yaml_path, 'r') as b:
                build_config = yaml.safe_load(b)
                if 'build_from' in build_config:
                    base_images = build_config['build_from']
                    # logic to check if these are official
                    # Usually: ghcr.io/hassio-addons/base/... or ghcr.io/home-assistant/...
                    for arch, image in base_images.items():
                        if not (image.startswith("ghcr.io/hassio-addons/base") or image.startswith("ghcr.io/home-assistant")):
                            warnings.append(f"Base image '{image}' for {arch} does not look like an official HA/Hassio-Addons base image.")
                    detected_base = True
        except Exception as e:
             errors.append(f"Failed to parse build.yaml: {e}")

    if not detected_base:
        # Fallback to Dockerfile FROM check
        for line in content.splitlines():
            if line.startswith("FROM"):
                image = line.split()[1]
                if not (image.startswith("ghcr.io/hassio-addons/base") or image.startswith("ghcr.io/home-assistant")):
                     warnings.append(f"Dockerfile Base image '{image}' does not look like an official HA/Hassio-Addons base image.")

    # Check 5: Translations
    if not os.path.exists(os.path.join(translations_dir, "en.yaml")):
        errors.append("Missing English translation (translations/en.yaml)")

    if not os.path.exists(os.path.join(translations_dir, "de.yaml")):
        warnings.append("Missing German translation (translations/de.yaml) - Recommended")

    # Check 6: Images
    if not os.path.exists(icon_path):
        errors.append("Missing icon.png")
    if not os.path.exists(logo_path):
        errors.append("Missing logo.png")


    if errors or warnings:
        print(f"🔍 Compliance Report for {addon_path}:")
        if errors:
            print("  ❌ Errors:")
            for err in errors:
                print(f"     - {err}")
        if warnings:
            print("  ⚠️ Warnings:")
            for warn in warnings:
                print(f"     - {warn}")
        print("--------------------------------------------------")

        if errors:
            return False, errors, warnings
        return True, errors, warnings

    print(f"✅ {addon_path} passed all basic compliance checks.")
    return True, [], []


def main():
    if len(sys.argv) < 2:
        print("Usage: python check_compliance.py <addon_dir> [addon_dir2 ...]")
        sys.exit(0) # Don't error if no args, just exit (simplifies workflow)

    failed = False

    print("==================================================")
    print("      ADD-ON COMPLIANCE CHECKER")
    print("==================================================")

    for addon in sys.argv[1:]:
        if not os.path.exists(addon):
             # Skip if not a directory (e.g. file passed by mistake)
             continue
        if not os.path.exists(os.path.join(addon, "config.yaml")):
             # Not an addon directory
             continue

        passed, _errors, _warnings = check_addon(addon)
        if not passed:
            failed = True

    if failed:
        sys.exit(1)


if __name__ == "__main__":
    main()
