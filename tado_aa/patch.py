import ast
import os
import shutil

FILE_PATH = "/tado_aa.py"


def replace_in_file(filepath, mapping):
    with open(filepath, "r") as f:
        content = f.read()

    replaced = []
    failed = []
    warnings = []

    for original, replacement in mapping.items():
        # Count occurrences before replacing
        occurrences = content.count(original)

        if occurrences == 0:
            failed.append(original)
            print(f"WARNING: Could not find original string: '{original}'")
            # Fail if critical parts are missing
            if "TOKEN_FILE" in original or "Tado(" in original:
                print(f"CRITICAL: Failed to patch '{original}'")
                exit(1)
        else:
            if occurrences > 1:
                warnings.append((original, occurrences))
                print(
                    f"WARNING: Found {occurrences} occurrences of '{original[:50]}...', "
                    "replacing only first match"
                )
            # Replace only the first occurrence to avoid unintended changes
            content = content.replace(original, replacement, 1)
            replaced.append(original)

    return content, replaced, failed, warnings


def validate_python_syntax(content: str) -> bool:
    """Validate that content is syntactically valid Python."""
    try:
        ast.parse(content)
        return True
    except SyntaxError as e:
        print(f"ERROR: Patched code has syntax error: {e}")
        return False


mapping = {
    'TOKEN_FILE = "refresh_token"': 'TOKEN_FILE = "/data/refresh_token"',
    "checkingInterval = 10.0": 'checkingInterval = float(os.getenv("TADO_CHECK_INTERVAL", "10.0"))',
    "errorRetryingInterval = 30.0": 'errorRetryingInterval = float(os.getenv("TADO_RETRY_INTERVAL", "30.0"))',
    "minTemp = 5": 'minTemp = int(os.getenv("TADO_MIN_TEMP", "5"))',
    "maxTemp = 25": 'maxTemp = int(os.getenv("TADO_MAX_TEMP", "25"))',
    "enableTempLimit = True": 'enableTempLimit = os.getenv("TADO_ENABLE_TEMP_LIMIT", "True").lower() == "true"',
    "saveLog = False": 'saveLog = os.getenv("TADO_SAVE_LOG", "False").lower() == "true"',
    # Original line is at 8 spaces inside login() try block
    # Replacement: define init_tado at same level, then call it
    "        t = Tado(token_file_path=TOKEN_FILE)": (
        "        def init_tado():\\n"
        '            username = os.getenv("TADO_USERNAME")\\n'
        '            password = os.getenv("TADO_PASSWORD")\\n'
        "            if username and password:\\n"
        "                return Tado(username, password, token_file_path=TOKEN_FILE)\\n"
        "            return Tado(token_file_path=TOKEN_FILE)\\n"
        "        t = init_tado()"
    ),
}

if __name__ == "__main__":
    if not os.path.exists(FILE_PATH):
        print(f"Error: {FILE_PATH} not found.")
        exit(1)

    # Create backup before patching
    backup_path = FILE_PATH + ".backup"
    shutil.copy2(FILE_PATH, backup_path)
    print(f"Created backup: {backup_path}")

    # Apply patches
    patched_content, replaced, failed, warnings = replace_in_file(FILE_PATH, mapping)

    # Validate syntax before writing
    if not validate_python_syntax(patched_content):
        print("ERROR: Patched code is invalid. Restoring backup...")
        shutil.copy2(backup_path, FILE_PATH)
        exit(1)

    # Write patched content
    with open(FILE_PATH, "w") as f:
        f.write(patched_content)

    print(f"Successfully patched {FILE_PATH}")
    print(f"Replaced: {len(replaced)}/{len(mapping)} patterns")
    if failed:
        print(f"Failed patterns: {len(failed)}")
    if warnings:
        print(f"Patterns with multiple occurrences (only first replaced): {len(warnings)}")

    # Cleanup backup on success
    os.remove(backup_path)
    print("Backup removed after successful patch.")
