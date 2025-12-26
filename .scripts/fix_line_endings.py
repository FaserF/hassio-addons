import os


def to_lf(path):
    try:
        with open(path, "rb") as f:
            content = f.read()

        # Replace CRLF with LF
        if b"\r\n" in content:
            print(f"Fixing CRLF in {path}")
            content = content.replace(b"\r\n", b"\n")
            with open(path, "wb") as f:
                f.write(content)
    except Exception as e:
        print(f"Error processing {path}: {e}")


import sys

extensions = [".sh", ".md", ".yaml", ".yml", ".json", "Dockerfile"]
skip_dirs = [".git", "node_modules", ".vscode"]
# simple prefix check for skip files
skip_prefixes = ["verification_results"]


def to_lf(path):
    try:
        with open(path, "rb") as f:
            content = f.read()

        # Replace CRLF with LF
        if b"\r\n" in content:
            print(f"Fixing CRLF in {path}")
            content = content.replace(b"\r\n", b"\n")
            with open(path, "wb") as f:
                f.write(content)
    except Exception as e:
        print(f"Error processing {path}: {e}")


def process_dir(start_dir):
    for root, dirs, files in os.walk(start_dir):
        # Skip ignored directories
        dirs[:] = [d for d in dirs if d not in skip_dirs]

        for file in files:
            if (
                any(file.startswith(prefix) for prefix in skip_prefixes)
                or file == "verify_log.txt"
            ):
                continue
            if any(file.endswith(ext) or file == ext for ext in extensions):
                to_lf(os.path.join(root, file))


if __name__ == "__main__":
    targets = sys.argv[1:] if len(sys.argv) > 1 else ["."]
    for target in targets:
        if os.path.isdir(target):
            process_dir(target)
        elif os.path.isfile(target):
            to_lf(target)
