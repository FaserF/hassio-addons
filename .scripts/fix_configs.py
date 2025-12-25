import os
import yaml

def fix_config(path):
    with open(path, 'r') as f:
        content = f.readlines()

    new_content = []
    changed = False

    for line in content:
        stripped = line.strip()

        # Remove deprecated keys if they are causing linter errors (usually defaults)
        # Note: We are removing lines purely based on key presence as requested by linter
        if stripped.startswith("startup:") or stripped.startswith("boot:") or stripped.startswith("ingress_port:"):
            print(f"Removing deprecated line in {path}: {stripped}")
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
        with open(path, 'w') as f:
            f.writelines(new_content)

for root, dirs, files in os.walk("."):
    if "config.yaml" in files:
        fix_config(os.path.join(root, "config.yaml"))
