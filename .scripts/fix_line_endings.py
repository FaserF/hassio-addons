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


extensions = [".sh", ".md", ".yaml", ".yml", ".json", "Dockerfile"]
skip_dirs = [".git", "node_modules", ".vscode"]
skip_files = ["verification_results.json", "verify_log.txt"]

for root, dirs, files in os.walk("."):
    # Skip ignored directories
    dirs[:] = [d for d in dirs if d not in skip_dirs]

    for file in files:
        if file in skip_files:
            continue
        if any(file.endswith(ext) or file == ext for ext in extensions):
            to_lf(os.path.join(root, file))
