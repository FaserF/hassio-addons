#!/usr/bin/env python3
"""Fix CRLF line endings to LF in repository files."""

import os
import sys

EXTENSIONS = [".sh", ".md", ".yaml", ".yml", ".json", "Dockerfile"]
SKIP_DIRS = [".git", "node_modules", ".vscode", "dist", "build", "coverage", ".venv", "env", "tmp"]
SKIP_PREFIXES = ["verification_results"]


def to_lf(path):
    """Convert CRLF to LF in the given file."""
    try:
        with open(path, "rb") as f:
            content = f.read()

        if b"\r\n" in content:
            print(f"Fixing CRLF in {path}")
            content = content.replace(b"\r\n", b"\n")
            with open(path, "wb") as f:
                f.write(content)
    except Exception as e:
        print(f"Error processing {path}: {e}")


def process_dir(start_dir):
    """Recursively process directory for CRLF files."""
    for root, dirs, files in os.walk(start_dir):
        dirs[:] = [d for d in dirs if d not in SKIP_DIRS]

        for file in files:
            if (
                any(file.startswith(prefix) for prefix in SKIP_PREFIXES)
                or file == "verify_log.txt"
            ):
                continue
            if any(file.endswith(ext) or file == ext for ext in EXTENSIONS):
                to_lf(os.path.join(root, file))


if __name__ == "__main__":
    targets = sys.argv[1:] if len(sys.argv) > 1 else ["."]
    for target in targets:
        if os.path.isdir(target):
            process_dir(target)
        elif os.path.isfile(target):
            to_lf(target)
