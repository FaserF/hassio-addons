import argparse
import os
import re
import sys

REPO_URL = "https://github.com/FaserF/hassio-addons"
REPO_BRANCH = "master"

REQUIRED_BADGES = [
    # "shields.io/badge/home%20assistant-addon-blue",
    # "shields.io/github/v/release",
    "shields.io/badge/rating"
]


def check_readme(addon_path, fix=False):
    readme_path = os.path.join(addon_path, "README.md")
    if not os.path.exists(readme_path):
        print(f"❌ {addon_path}: README.md missing")
        return False

    with open(readme_path, "r", encoding="utf-8") as f:
        content = f.read()

    errors = []

    # Check "Open in Home Assistant" badge
    my_ha_badge = "https://my.home-assistant.io/badges/supervisor_addon.svg"

    # Calculate correct slug: hash_directory
    # Repo Hash for https://github.com/FaserF/hassio-addons is c1e285b7
    repo_hash = "c1e285b7"
    slug = f"{repo_hash}_{os.path.basename(addon_path)}"

    my_ha_link = f"https://my.home-assistant.io/redirect/supervisor_addon/?addon={slug}"

    badge_markdown = f"[![Open your Home Assistant instance and show the add-on dashboard.]({my_ha_badge})]({my_ha_link})"

    # Check if correct badge is present
    if my_ha_link not in content:
        errors.append("Missing or incorrect 'Open in Home Assistant' badge.")
        if fix:
            print(f"🔧 Injecting/Updating Open in HA badge for {addon_path}")

            placeholder_part = "addon_slug_placeholder_please_fix"

            # 1. Try to fix existing bad link (placeholder)
            # The placeholder might look like .../?addon_slug_placeholder... or .../?addon=addon_slug_placeholder...

            if placeholder_part in content:
                # Case A: .../?addon_slug_placeholder... (Malformed)
                if f"?{placeholder_part}" in content:
                    content = content.replace(f"?{placeholder_part}", f"?addon={slug}")
                # Case B: .../?addon=addon_slug_placeholder... (Well formed)
                elif f"={placeholder_part}" in content:
                    content = content.replace(f"={placeholder_part}", f"={slug}")
                # Case C: Just the string (fallback)
                else:
                    content = content.replace(placeholder_part, slug)

            # 2. Try to fix naive link if I created it differently before (e.g. just ?addon=path)
            elif f"?addon={addon_path}" in content:
                content = content.replace(f"?addon={addon_path}", f"?addon={slug}")

            # 3. If badge missing entirely, prepend
            elif my_ha_badge not in content:
                content = f"{badge_markdown}\n\n{content}"

            with open(readme_path, "w", encoding="utf-8") as f:
                f.write(content)
            print("   Fixed.")

    # Check Documentation link - should be absolute GitHub link, not relative
    # Match various patterns: [Documentation](DOCS.md), [Documentation](./DOCS.md), etc.
    docs_link_patterns = [
        (r"\[Documentation\]\(DOCS\.md\)", "DOCS.md"),
        (r"\[Documentation\]\(\./DOCS\.md\)", "./DOCS.md"),
        (r"\[Documentation\]\(\.\./DOCS\.md\)", "../DOCS.md"),
    ]

    for pattern, link_text in docs_link_patterns:
        if re.search(pattern, content):
            errors.append(f"Documentation link is relative ({link_text}) instead of absolute GitHub link.")
            if fix:
                print(f"🔧 Fixing Documentation link for {addon_path}")
                # Check if DOCS.md exists
                docs_path = os.path.join(addon_path, "DOCS.md")
                if os.path.exists(docs_path):
                    # Determine the GitHub path
                    # Normalize path separators and get relative path from repo root
                    rel_path = os.path.relpath(addon_path, ".").replace("\\", "/")
                    # Construct absolute GitHub link
                    github_link = f"{REPO_URL}/blob/{REPO_BRANCH}/{rel_path}/DOCS.md"
                    # Replace relative link with absolute link
                    content = re.sub(
                        pattern,
                        f"[Documentation]({github_link})",
                        content
                    )
                    with open(readme_path, "w", encoding="utf-8") as f:
                        f.write(content)
                    print(f"   Fixed Documentation link (replaced {link_text}).")
                    break  # Only fix once
                else:
                    print(f"   ⚠️ DOCS.md not found, skipping link fix.")
                    break

    # Heuristic check for other badges
    if "img.shields.io" not in content and "shields.io" not in content:
        # Warn but hard to auto-fix specific version badges without knowledge
        errors.append("No standard badges found (heuristic).")

    if errors and not fix:
        print(f"❌ {addon_path} README Gaps:")
        for err in errors:
            print(f"   - {err}")
        return False

    print(f"✅ {addon_path} README passed.")
    return True


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--fix", action="store_true", help="Attempt to fix errors")
    parser.add_argument("dirs", nargs="*", help="Directories to scan")
    args = parser.parse_args()

    dirs = args.dirs
    if not dirs:
        dirs = [
            d for d in os.listdir(".") if os.path.isdir(d) and not d.startswith(".")
        ]
        # Also check .unsupported directory
        unsupported_path = ".unsupported"
        if os.path.exists(unsupported_path):
            for d in os.listdir(unsupported_path):
                d_path = os.path.join(unsupported_path, d)
                if os.path.isdir(d_path):
                    dirs.append(d_path)

    failed = False
    for d in dirs:
        # Only check if it looks like an addon (has config)
        if os.path.exists(os.path.join(d, "config.yaml")) or os.path.exists(
            os.path.join(d, "config.json")
        ):
            if not check_readme(d, fix=args.fix):
                failed = True

    if failed and not args.fix:
        sys.exit(1)


if __name__ == "__main__":
    main()
