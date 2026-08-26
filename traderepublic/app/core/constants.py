import os

DATA_DIR = os.getenv("DATA_DIR", "/data")
STORAGE_STATE_PATH = os.path.join(DATA_DIR, "browser_cookies.json")
SESSION_FILE_PATH = os.path.join(DATA_DIR, "session.json")
CDP_PORT = 9222
KEEP_ALIVE_INTERVAL = int(os.getenv("KEEP_ALIVE_INTERVAL", "60"))
USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36"
)
