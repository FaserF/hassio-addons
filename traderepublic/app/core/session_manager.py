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

    def save(
        self,
        token: str,
        phone: Optional[str] = None,
        login_time: Optional[float] = None,
        logout_time: Optional[float] = None,
        logout_reason: Optional[str] = None,
        duration_seconds: Optional[float] = None,
    ) -> None:
        """Save session token and statistics to disk."""
        if not token:
            _LOGGER.warning("Attempted to save empty session token")
            return
        clean_tok = token.strip().strip('"').strip("'")
        os.makedirs(DATA_DIR, exist_ok=True)
        existing = self.load()
        payload = {
            "session_token": clean_tok,
            "phone_number": phone or existing.get("phone_number"),
            "updated_at": time.time(),
            "last_login_time": login_time or existing.get("last_login_time") or time.time(),
            "last_logout_time": logout_time,
            "last_logout_reason": logout_reason,
            "last_session_duration": duration_seconds,
        }
        try:
            with open(self.file_path, "w", encoding="utf-8") as f:
                json.dump(payload, f, indent=2)
            _LOGGER.info("Session saved successfully (token length: %s)", len(clean_tok))
        except Exception as e:
            _LOGGER.error("Failed to save session: %s", e)

    def record_logout(
        self,
        reason: str,
        duration_seconds: Optional[float] = None,
        logout_time: Optional[float] = None,
    ) -> None:
        """Record session termination details to disk."""
        existing = self.load()
        now = time.time()
        logout_t = logout_time or now
        existing["last_logout_time"] = logout_t
        existing["last_logout_reason"] = reason
        if duration_seconds is not None:
            existing["last_session_duration"] = duration_seconds
        else:
            login_t = existing.get("last_login_time")
            if login_t:
                existing["last_session_duration"] = max(0.0, logout_t - float(login_t))
        try:
            with open(self.file_path, "w", encoding="utf-8") as f:
                json.dump(existing, f, indent=2)
        except Exception as e:
            _LOGGER.debug("Failed to record logout: %s", e)

