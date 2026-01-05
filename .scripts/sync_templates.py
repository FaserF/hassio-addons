import os

TEMPLATE_PATH = ".github/ISSUE_TEMPLATE/bug_report.yml"


def get_addons():
    addons = []
    for item in os.listdir("."):
        if (
            os.path.isdir(item)
            and not item.startswith(".")
            and os.path.exists(os.path.join(item, "config.yaml"))
        ):
            addons.append(item)
    return sorted(addons)


def sync_template():
    if not os.path.exists(TEMPLATE_PATH):
        print(f"❌ Template not found at {TEMPLATE_PATH}")
        return

    print(f"📄 Reading {TEMPLATE_PATH}...")
    with open(TEMPLATE_PATH, "r", encoding="utf-8") as f:
        lines = f.readlines()

    new_options = get_addons()
    new_options.insert(0, "Other")

    # Find the range of lines to replace
    # We look for:
    #   - label: Add-On causing the issue
    #   ...
    #   - options:
    #     - ...

    start_index = -1
    end_index = -1
    indentation = ""

    # State machine to find the specific options block
    found_label = False

    for i, line in enumerate(lines):
        if "label: Add-On causing the issue" in line:
            found_label = True

        if found_label and line.strip().startswith("options:"):
            # found the options start
            start_index = i + 1
            # Capture indentation of the options list items (usually 2 or 4 spaces more than options:)
            # But here we just assume standard yaml list indentation
            # Check next line to guess indentation if possible, or default to 4 spaces
            break

    if start_index != -1:
        # Find end of the list. The list ends when indentation changes back or less,
        # or we hit a key that is not a list item.
        # Actually in this specific file, the options are likely the last thing or followed by another key at same level as 'options' or 'attributes'.
        # 'options' is indented. List items are indented further.

        # Let's peek at the indentation of 'options:'
        options_line = lines[start_index - 1]
        options_indent = len(options_line) - len(options_line.lstrip())

        for j in range(start_index, len(lines)):
            line = lines[j]
            stripped = line.strip()

            if not stripped: # empty line
                continue

            cur_indent = len(line) - len(line.lstrip())

            # If line is less indented than options, or same indent but not a dash (next key)
            # List items usually start with "- " and have indent > options_indent,
            # BUT sometimes they are at the same indentation level in valid YAML.

            if cur_indent < options_indent:
                # Definitely end of block (parent key or unindent)
                end_index = j
                break

            if cur_indent == options_indent:
                if not stripped.startswith("-"):
                    # Sibling key
                    end_index = j
                    break
                # If it starts with "-", it's a list item, so we continue encompassing it.

        if end_index == -1:
            end_index = len(lines)

        print(f"✅ Updating add-on list options between lines {start_index+1} and {end_index}")

        # Construct new lines
        new_lines_list = []
        # We need to determine correct indentation.
        # Usually 4 spaces for the list item if options is inside attributes
        # Actually usually it is:
        # attributes:
        #   options:
        #     - item

        # We need to determine correct indentation.
        # Usually 2 spaces deeper than options
        item_indent = " " * (options_indent + 2)

        for opt in new_options:
            new_lines_list.append(f"{item_indent}- {opt}\n")

        # Replace
        lines[start_index:end_index] = new_lines_list

        with open(TEMPLATE_PATH, "w", encoding="utf-8") as f:
            f.writelines(lines)
        print("✅ Template updated.")

    else:
        print("⚠️ Could not find 'Add-On causing the issue' -> 'options:' block.")

if __name__ == "__main__":
    sync_template()
