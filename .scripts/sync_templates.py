import os
import yaml

TEMPLATE_PATH = ".github/ISSUE_TEMPLATE/bug_report.yml"

def get_addons():
    addons = []
    for item in os.listdir("."):
        if os.path.isdir(item) and not item.startswith(".") and os.path.exists(os.path.join(item, "config.yaml")):
            addons.append(item)
    return sorted(addons)

def sync_template():
    if not os.path.exists(TEMPLATE_PATH):
        print(f"❌ Template not found at {TEMPLATE_PATH}")
        return

    print(f"📄 Reading {TEMPLATE_PATH}...")
    with open(TEMPLATE_PATH, "r") as f:
        data = yaml.safe_load(f)

    # Find the dropdown input for "Which add-on is having issues?"
    # Structure varies, assuming standard GitHub Form schema
    # body: [ { type: dropdown, id: addon, attributes: { options: [] } } ]

    found = False
    new_options = get_addons()
    new_options.insert(0, "Other") # Ensure 'Other' is there

    if 'body' in data:
        for input_field in data['body']:
            if input_field.get('type') == 'dropdown':
                label = input_field.get('attributes', {}).get('label', '').lower()
                if 'add-on' in label or 'addon' in label:
                    print(f"Found input: {label}")
                    input_field['attributes']['options'] = new_options
                    found = True
                    break

    if found:
        print(f"✅ Updating add-on list to: {new_options}")
        # Write back (preserving comments is hard with PyYAML, but GitHub Forms don't usually have crucial comments inside YAML structure we need directly)
        # Note: PyYAML might reorder keys. For standards, it's usually acceptable.
        with open(TEMPLATE_PATH, "w") as f:
            yaml.dump(data, f, sort_keys=False, default_flow_style=False)
    else:
        print("⚠️ Could not find Add-on dropdown in template.")

if __name__ == "__main__":
    sync_template()
