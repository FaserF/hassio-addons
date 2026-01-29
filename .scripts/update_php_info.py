import re
import os
from pathlib import Path

# Addons to process
ADDONS = ["apache2", "apache2-minimal-mariadb", "nginx"]
DOC_FILE = "DOCS.md"

def get_php_info(dockerfile_path):
    """Extracts PHP version and modules from Dockerfile."""
    content = dockerfile_path.read_text(encoding="utf-8")

    # Try to find ARG PHP_VERSION
    php_version = None
    php_version_num = None
    arg_match = re.search(r'ARG PHP_VERSION="([^"]+)"', content)
    if arg_match:
        php_version = arg_match.group(1) # e.g. "8.5"
        php_version_num = php_version.replace(".", "") # e.g. "85"
    else:
        # Fallback to old behavior
        versions = re.findall(r"php(\d+)", content)
        if versions:
            php_version_num = max(set(versions), key=versions.count)
            php_version = f"{php_version_num[0]}.{php_version_num[1]}"

    if not php_version_num:
        return None, []

    # Find modules
    # Look for php85-module or php${PHP_VERSION//./}-module
    modules = []

    # Regular literal matches
    matches = re.finditer(f"php{php_version_num}-([a-zA-Z0-9_\-]+)", content)
    for m in matches:
        mod = m.group(1)
        if mod not in ["dev", "pear", "doc", "apache2", "fpm", "cgi"]:
            modules.append(mod)

    # Variable matches: php${PHP_V...}-([a-zA-Z0-9_\-]+)
    # This matches both PHP_VERSION and PHP_V
    var_pattern = r'php\$\{PHP_V(?:ERSION)?.*?\}-([a-zA-Z0-9_\-]+)'
    matches = re.finditer(var_pattern, content)
    for m in matches:
        mod = m.group(1)
        if mod not in ["dev", "pear", "doc", "apache2", "fpm", "cgi"]:
            modules.append(mod)

    # Special case for "php85" or "php${PHP_VERSION}" as the base package
    # We don't Add that to modules list usually.

    # Remove duplicates and sort
    modules = sorted(list(set(modules)))

    return php_version, modules

def update_doc_file(doc_path, php_version, modules):
    """Updates the DOCS.md file with PHP info."""
    if not doc_path.exists():
        print(f"Warning: {doc_path} does not exist.")
        return

    content = doc_path.read_text(encoding="utf-8")

    # Generate the text
    module_list = "\n".join([f"- {m}" for m in modules])

    info_text = f"""<!-- PHP_INFO_START -->
## 🐘 PHP Information

**PHP Version**: {php_version}

**Available PHP Modules**:
{module_list}
<!-- PHP_INFO_END -->"""

    # Check if markers exist
    if "<!-- PHP_INFO_START -->" in content:
        # Replace existing
        pattern = r"<!-- PHP_INFO_START -->.*<!-- PHP_INFO_END -->"
        new_content = re.sub(pattern, info_text, content, flags=re.DOTALL)
    else:
        # Append to end or before "Support" section
        if "## Support" in content:
            new_content = content.replace("## Support", f"{info_text}\n\n## Support")
        else:
            new_content = content + "\n\n" + info_text

    if content != new_content:
        doc_path.write_text(new_content, encoding="utf-8")
        print(f"Updated {doc_path} with PHP {php_version} info.")
    else:
        print(f"No changes for {doc_path}.")

def main():
    repo_root = Path(".")

    for addon in ADDONS:
        addon_dir = repo_root / addon
        if not addon_dir.exists():
            continue

        dockerfile = addon_dir / "Dockerfile"
        if not dockerfile.exists():
            continue

        php_ver, modules = get_php_info(dockerfile)
        if php_ver:
            doc_file = addon_dir / DOC_FILE
            update_doc_file(doc_file, php_ver, modules)

if __name__ == "__main__":
    main()
