import os

FILE_PATH = "/tado_aa.py"

def replace_in_file(filepath, mapping):
    with open(filepath, 'r') as f:
        content = f.read()

    for original, replacement in mapping.items():
        if original not in content:
            print(f"WARNING: Could not find original string: '{original}'")
            # We might want to exit 1 here if strictness is required,
            # but for now let's just warn to avoid breaking if minor things change.
            # actually, given the nitpick was about fragility, let's fail if critical parts miss.
            if "TOKEN_FILE" in original or "Tado(" in original:
                 print(f"CRITICAL: Failed to patch '{original}'")
                 exit(1)
        content = content.replace(original, replacement)

    with open(filepath, 'w') as f:
        f.write(content)
    print(f"Successfully patched {filepath}")

mapping = {
    'TOKEN_FILE = "refresh_token"': 'TOKEN_FILE = "/data/refresh_token"',
    'checkingInterval = 10.0': 'checkingInterval = float(os.getenv("TADO_CHECK_INTERVAL", "10.0"))',
    'errorRetryingInterval = 30.0': 'errorRetryingInterval = float(os.getenv("TADO_RETRY_INTERVAL", "30.0"))',
    'minTemp = 5': 'minTemp = int(os.getenv("TADO_MIN_TEMP", "5"))',
    'maxTemp = 25': 'maxTemp = int(os.getenv("TADO_MAX_TEMP", "25"))',
    'enableTempLimit = True': 'enableTempLimit = os.getenv("TADO_ENABLE_TEMP_LIMIT", "True").lower() == "true"',
    'saveLog = False': 'saveLog = os.getenv("TADO_SAVE_LOG", "False").lower() == "true"',
    't = Tado(token_file_path=TOKEN_FILE)': 'username=os.getenv("TADO_USERNAME"); password=os.getenv("TADO_PASSWORD"); t=Tado(username, password, token_file_path=TOKEN_FILE) if (username and password) else Tado(token_file_path=TOKEN_FILE)'
}

if __name__ == "__main__":
    if not os.path.exists(FILE_PATH):
        print(f"Error: {FILE_PATH} not found.")
        exit(1)
    replace_in_file(FILE_PATH, mapping)
