import os
import subprocess


def run_command(cmd, shell=True):
    result = subprocess.run(cmd, shell=shell, capture_output=True, text=True)
    return result.stdout.strip(), result.stderr.strip()


def main():
    # Get list of modified files
    stdout, _ = run_command("git status --porcelain")
    lines = stdout.splitlines()

    modified_files = []
    for line in lines:
        if line.startswith(" M "):
            modified_files.append(line[3:])

    print(f"Found {len(modified_files)} modified files.")

    discarded_count = 0
    preserved_count = 0

    binary_extensions = {
        ".png",
        ".jpg",
        ".jpeg",
        ".gif",
        ".zip",
        ".ico",
        ".pdf",
        ".woff",
        ".woff2",
        ".ttf",
        ".eot",
    }

    for file_path in modified_files:
        # Check if binary
        _, ext = os.path.splitext(file_path.lower())
        if ext in binary_extensions:
            print(f"Discarding binary file: {file_path}")
            run_command(f'git checkout -- "{file_path}"')
            discarded_count += 1
            continue

        # Check for real changes (ignoring whitespace)
        diff, _ = run_command(f'git diff -w -- "{file_path}"')

        if not diff:
            print(f"Discarding pseudo-change: {file_path}")
            run_command(f'git checkout -- "{file_path}"')
            discarded_count += 1
        else:
            print(f"Preserving real change: {file_path}")
            preserved_count += 1

    print(
        f"Done. Discarded {discarded_count} files, preserved {preserved_count} files."
    )


if __name__ == "__main__":
    main()
