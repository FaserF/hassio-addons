import os
import re


def clean_lines(file_path):
    with open(file_path, "r", encoding="utf-8") as f:
        content = f.read()

    # Replace 3 or more newlines (potentially with whitespace) with 2 newlines (max 1 blank line)
    new_content = re.sub(r"\n\s*\n\s*\n+", "\n\n", content)

    # Also trim trailing newlines at the end of file to exactly one
    new_content = new_content.rstrip() + "\n"

    if content != new_content:
        with open(file_path, "w", encoding="utf-8", newline="\n") as f:
            f.write(new_content)
        print(f"Cleaned: {file_path}")
        return True
    return False


def main():
    extensions = [".sh", ".yaml", ".yml", "Dockerfile", ".md", ".json"]
    root_dir = "."
    count = 0

    for dirpath, dirnames, filenames in os.walk(root_dir):
        # Skip hidden and cache directories
        dirnames[:] = [d for d in dirnames if not d.startswith(".") and d not in ["__pycache__", "node_modules", "venv"]]

        for filename in filenames:
            if any(filename.endswith(ext) or filename == ext for ext in extensions):
                file_path = os.path.join(dirpath, filename)
                try:
                    if clean_lines(file_path):
                        count += 1
                except Exception as e:
                    print(f"Error reading {file_path}: {e}")

    print(f"Total files cleaned: {count}")


if __name__ == "__main__":
    main()
