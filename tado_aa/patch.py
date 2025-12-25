import os

FILE_PATH = "/tado_aa.py"


def replace_in_file(filepath, mapping):
    with open(filepath, "r") as f:
        content = f.read()

    replaced = []
    failed = []

    for original, replacement in mapping.items():
        if original not in content:
            failed.append(original)
            print(f"WARNING: Could not find original string: '{original}'")
            # Fail if critical parts are missing
            if "TOKEN_FILE" in original or "Tado(" in original:
                print(f"CRITICAL: Failed to patch '{original}'")
                exit(1)
        else:
            replaced.append(original)
            content = content.replace(original, replacement)

    with open(filepath, "w") as f:
        f.write(content)

    print(f"Successfully patched {filepath}")
    print(f"Replaced: {len(replaced)}/{len(mapping)} patterns")
    if failed:
        print(f"Failed patterns: {len(failed)}")


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
    replace_in_file(FILE_PATH, mapping)
