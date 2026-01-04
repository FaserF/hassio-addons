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
            print(f"WARNING: Could not find original string: '{original[:50]}...'")
            # Fail if critical parts are missing
            if "TOKEN_FILE" in original or "Tado(" in original:
                print(f"CRITICAL: Failed to patch '{original[:50]}...'")
                exit(1)
        else:
            if occurrences > 1:
                warnings.append((original, occurrences))
                print(
                    f"WARNING: Found {occurrences} occurrences of '{original[:50]}...', "
                    "replacing only first match"
                )
            # Replace first occurrence only
            # Handle multiline replacements by normalizing line endings
            normalized_original = original.replace("\r\n", "\n").replace("\r", "\n")
            normalized_replacement = replacement.replace("\r\n", "\n").replace("\r", "\n")
            content = content.replace(normalized_original, normalized_replacement, 1)
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
    "errorRetringInterval = 30.0": 'errorRetringInterval = float(os.getenv("TADO_RETRY_INTERVAL", "30.0"))',
    "minTemp = 5": 'minTemp = int(os.getenv("TADO_MIN_TEMP", "5"))',
    "maxTemp = 25": 'maxTemp = int(os.getenv("TADO_MAX_TEMP", "25"))',
    "enableTempLimit = True": 'enableTempLimit = os.getenv("TADO_ENABLE_TEMP_LIMIT", "True").lower() == "true"',
    "saveLog = False": 'saveLog = os.getenv("TADO_SAVE_LOG", "False").lower() == "true"',
    '        if status == "PENDING":\n            url = t.device_verification_url()\n            print(f"Please visit this URL to authenticate:\\n")\n            print(f\'{url}\')': '        if status == "PENDING":\n            verification_result = t.device_verification_url()\n            if isinstance(verification_result, tuple):\n                url, user_code = verification_result\n            else:\n                url = verification_result\n                user_code = None\n            print(f"Please visit this URL to authenticate:\\n")\n            if user_code:\n                print(f"{url}?user_code={user_code}")\n            else:\n                print(f"{url}")',
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
        print(
            f"Patterns with multiple occurrences (only first replaced): {len(warnings)}"
        )

    # Cleanup backup on success
    os.remove(backup_path)
    print("Backup removed after successful patch.")
