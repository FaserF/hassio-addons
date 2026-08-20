import json
import logging
import os
import time
from typing import Any, Dict, Optional

from .constants import DATA_DIR, SESSION_FILE_PATH

_LOGGER = logging.getLogger(__name__)


class SessionManager:
    """Manages persistent session storage on disk."""

    def __init__(self, file_path: str = SESSION_FILE_PATH) -> None:
        self.file_path = file_path

    def load(self) -> Dict[str, Any]:
        """Load session data from disk if available."""
        if os.path.exists(self.file_path):
            try:
                with open(self.file_path, "r", encoding="utf-8") as f:
                    return json.load(f)
            except Exception as e:
                _LOGGER.warning("Failed to load session file: %s", e)
        return {}

    def save(self, token: str, phone: Optional[str] = None) -> None:
        """Save session token and phone number to disk."""
        if not token:
            _LOGGER.warning("Attempted to save empty session token")
            return
        clean_tok = token.strip().strip('"').strip("'")
        os.makedirs(DATA_DIR, exist_ok=True)
        try:
            with open(self.file_path, "w", encoding="utf-8") as f:
                json.dump(
                    {
                        "session_token": clean_tok,
                        "phone_number": phone,
                        "updated_at": time.time(),
                    },
                    f,
                    indent=2,
                )
            _LOGGER.info("Session saved successfully (token length: %s)", len(clean_tok))
        except Exception as e:
            _LOGGER.error("Failed to save session: %s", e)
