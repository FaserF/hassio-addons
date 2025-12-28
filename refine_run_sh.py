import os
import re
import shutil
import tempfile
from pathlib import Path

# Configuration
# Use RUN_SH_BASE env var or default to the repository root (parent of script location)
BASE_DIR = os.getenv("RUN_SH_BASE", str(Path(__file__).parent.absolute()))
REPO_ROOT = Path(BASE_DIR)

# 1. Regex to remove the header block (if still present)
header_regex = re.compile(
    r"# =+\n#  FaserF's Addon Repository\n#  GitHub: https://github\.com/FaserF/hassio-addons\n# =+\n\n?",
    re.MULTILINE
)

# 2. Regex to remove the print_banner function and its call
# This is tricky because the content varies slightly across files.
# We will target the known structure, allowing for whitespace variations.
banner_func_regex = re.compile(
    r"# Banner Function\s+print_banner\(\) \{.*?\}\s+print_banner",
    re.DOTALL
)

# 3. Regex to find the bashio sourcing line or any suitable insertion point
bashio_source_regex = re.compile(
    r"source /usr/lib/bashio/bashio.sh"
)

def refine_file(file_path: Path):
    try:
        if not file_path.exists():
            print(f"⚠️ Skipping non-existent file: {file_path}")
            return

        print(f"🔍 Processing {file_path}")

        with open(file_path, 'r', encoding='utf-8', newline='') as f:
            content = f.read()

        original_content = content

        # A. Remove header
        content = header_regex.sub("", content)

        # B. Replace print_banner() with shared version
        # First, find if it has the local definition
        if "print_banner() {" in content:
            # Remove the local function definition and its call
            content = banner_func_regex.sub("", content)

            # Now, ensure banner.sh is sourced and called
            banner_include = (
                "source /usr/lib/bashio/banner.sh\n"
                "bashio::addon.print_banner\n"
            )

            # Where to insert?
            # If bashio.sh is sourced, put it after that.
            if bashio_source_regex.search(content):
                content = bashio_source_regex.sub(lambda m: f"{m.group(0)}\n{banner_include}", content)
            else:
                # Fallback: Put it near the top after shebang and set -e
                lines = content.splitlines()
                insertion_point = 0
                for i, line in enumerate(lines):
                    if line.startswith("#!"):
                        insertion_point = i + 1
                    elif line.startswith("set -e"):
                        insertion_point = i + 1

                lines.insert(insertion_point, banner_include)
                content = "\n".join(lines)

        # C. Post-processing: Remove leftover labels and deduplicate insertions
        # Remove orphaned # Banner Function labels
        content = re.sub(r"# Banner Function\s+\n", "", content)

        # Deduplicate banner.sh sourcing and calls
        content = re.sub(r"(source /usr/lib/bashio/banner.sh\n+bashio::addon.print_banner\n+)+", r"source /usr/lib/bashio/banner.sh\nbashio::addon.print_banner\n", content)

        # Remove redundant addon_version assignment if it was likely only for the banner
        # We target the specific line: addon_version=$(bashio::addon.version)
        # But only if it's not used elsewhere (simple check)
        if "addon_version=$(bashio::addon.version)" in content:
            # Count occurrences of addon_version
            if content.count("addon_version") <= 1:
                content = content.replace("addon_version=$(bashio::addon.version)\n", "")

        # Remove extra blank lines created by removal
        content = re.sub(r"\n{3,}", "\n\n", content)

        if content != original_content:
            # Atomic Write
            dir_name = file_path.parent
            with tempfile.NamedTemporaryFile('w', dir=dir_name, delete=False, encoding='utf-8', newline='\n') as tf:
                tf.write(content)
                temp_name = tf.name

            try:
                # Preserve permissions
                shutil.copymode(file_path, temp_name)
                os.replace(temp_name, file_path)
                print(f"  ✅ Refined {file_path}")
            except Exception as e:
                os.unlink(temp_name)
                raise e
        else:
            print(f"  ℹ️ No changes needed for {file_path}")

    except Exception as e:
        print(f"❌ Error processing {file_path}: {e}")

def main():
    print(f"🚀 Starting refinement in {REPO_ROOT}")

    # Discover all run.sh and service run files
    # Typical patterns: */run.sh, **/services.d/*/run, **/cont-init.d/*.sh
    search_patterns = [
        "**/run.sh",
        "**/services.d/*/run",
        "**/cont-init.d/*.sh",
    ]

    processed_files = set()

    for pattern in search_patterns:
        for p in REPO_ROOT.glob(pattern):
            if ".antigravity" in str(p) or ".git" in str(p):
                continue

            # Normalize path
            abs_p = p.absolute()
            if abs_p not in processed_files:
                refine_file(abs_p)
                processed_files.add(abs_p)

    print(f"\n✨ Done! Processed {len(processed_files)} unique files.")

if __name__ == "__main__":
    main()
