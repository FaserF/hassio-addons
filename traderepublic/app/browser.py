import asyncio
import logging
import os
import subprocess
import time
from typing import Any, Dict, Optional

from core.auth import AuthHelper
from core.cdp import CDPClient
from core.constants import CDP_PORT, DATA_DIR, KEEP_ALIVE_INTERVAL
from core.session_manager import SessionManager
from core.verifier import verify_tr_token

_LOGGER = logging.getLogger(__name__)


class TradeRepublicBrowserService:
    """Orchestrates Chromium, Session Persistence, Authentication, and 24/7 Keepalive."""

    def __init__(self) -> None:
        self.cdp = CDPClient(CDP_PORT)
        self.session_manager = SessionManager()
        self.auth_helper = AuthHelper(self.cdp)

        self.proc: Optional[subprocess.Popen] = None
        self.is_logged_in: bool = False
        self.session_token: Optional[str] = None
        self.phone_number: Optional[str] = None
        self.status_message: str = "App started. Ready for login."
        self.last_sync_time: Optional[float] = None
        self.last_error: Optional[str] = None
        self.client_requests_count: int = 0
        self.token_verified_at: Optional[float] = None

        self._lock = asyncio.Lock()
        self._keepalive_task: Optional[asyncio.Task] = None
        self.login_started_at: Optional[float] = None

    async def start(self) -> None:
        """Start headless Chromium with remote debugging port."""
        try:
            os.makedirs(DATA_DIR, exist_ok=True)
            user_data_dir = os.path.join(DATA_DIR, "chromium_profile")
            os.makedirs(user_data_dir, exist_ok=True)

            cmd = [
                "/usr/bin/chromium-browser",
                "--headless=new",
                f"--remote-debugging-port={CDP_PORT}",
                f"--user-data-dir={user_data_dir}",
                "--no-sandbox",
                "--disable-setuid-sandbox",
                "--disable-dev-shm-usage",
                "--disable-gpu",
                "--disable-blink-features=AutomationControlled",
                "--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
                "https://app.traderepublic.com",
            ]
            _LOGGER.info("Launching headless Chromium via CDP...")
            self.proc = subprocess.Popen(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

            ready = await self.cdp.wait_for_ready(timeout=20.0)
            if not ready:
                _LOGGER.warning("Chromium CDP not ready within 20s — proceeding anyway")

            await self._load_saved_session()
            self._keepalive_task = asyncio.create_task(self._keepalive_loop())
        except Exception as e:
            _LOGGER.error("Failed to start browser process: %s", e)
            self.status_message = f"Error starting browser: {e}"

    async def verify_token_validity(self, token: str) -> bool:
        """Verify token against Trade Republic WebSocket backend."""
        is_valid = await verify_tr_token(token)
        if is_valid:
            self.token_verified_at = time.time()
        return is_valid

    async def _load_saved_session(self) -> None:
        data = self.session_manager.load()
        if data:
            self.session_token = data.get("session_token")
            self.phone_number = data.get("phone_number")
            if self.session_token:
                is_valid = await self.verify_token_validity(self.session_token)
                if not is_valid:
                    _LOGGER.info("Saved token from file invalid, attempting extraction from browser cookies/storage...")
                    browser_token = await self.auth_helper.extract_token_from_cookies()
                    if browser_token:
                        is_valid = await self.verify_token_validity(browser_token)
                        if is_valid:
                            self.session_token = browser_token

                self.is_logged_in = is_valid
                if is_valid:
                    self.status_message = "Everything is connected and running normally."
                    self.last_error = None
                    if self.session_token:
                        await self.auth_helper.inject_session_cookies(self.session_token)
                else:
                    self.status_message = "Stored session token is expired. Please re-authenticate."
                    self.last_error = (
                        "Session expired or rejected by Trade Republic (HTTP 401). Please click Re-authenticate."
                    )

    async def save_session(self, token: str, phone: Optional[str] = None) -> None:
        if not token:
            _LOGGER.warning("Attempted to save empty session token")
            return
        clean_tok = token.strip().strip('"').strip("'")
        self.session_token = clean_tok
        if phone:
            self.phone_number = phone
        self.is_logged_in = True
        self.status_message = "Everything is connected and running normally. Re-login is only required if your session expires or if you experience connection issues."
        self.last_error = None
        self.session_manager.save(clean_tok, self.phone_number)
        await self.auth_helper.inject_session_cookies(clean_tok)

    async def start_login(self, phone: str, pin: str) -> Dict[str, Any]:
        """Navigate and input credentials via CDP + direct API fallback with AWS WAF token."""
        async with self._lock:
            try:
                raw_phone = (phone or "").strip().replace(" ", "").replace("-", "").replace("/", "")
                if raw_phone.startswith("00"):
                    clean_phone = "+" + raw_phone[2:]
                elif raw_phone.startswith("+"):
                    clean_phone = raw_phone
                elif raw_phone.startswith("0") and len(raw_phone) >= 9:
                    clean_phone = "+49" + raw_phone[1:]
                else:
                    clean_phone = "+" + raw_phone

                digits_only = "".join(filter(str.isdigit, clean_phone))
                if not clean_phone.startswith("+") or not (7 <= len(digits_only) <= 15):
                    return {
                        "success": False,
                        "error": "Invalid international phone number. Please include your country code (e.g. +49..., +33..., +34..., +43..., +41..., +31...).",
                    }

                clean_pin = (pin or "").strip()
                if not clean_pin.isdigit() or not (4 <= len(clean_pin) <= 6):
                    return {"success": False, "error": "Invalid PIN. PIN must be 4 to 6 digits (numbers only)."}

                self.phone_number = clean_phone
                self.is_logged_in = False
                self.session_token = None
                self.login_started_at = time.time()

                self.status_message = "Navigating to Trade Republic login..."
                login_res = await self.auth_helper.execute_login(clean_phone, clean_pin)

                self.status_message = login_res.get("message", "Credentials submitted. Please confirm on smartphone.")
                asyncio.create_task(self._poll_for_app_approval())

                return {
                    "success": True,
                    "step": "2fa_required",
                    "message": self.status_message,
                }
            except Exception as e:
                _LOGGER.error("Login init error: %s", e)
                return {"success": False, "error": f"Internal browser error: {e}"}

    async def _poll_for_app_approval(self) -> None:
        """Poll for session token in background for 120s after credentials submission."""
        for _ in range(40):
            await asyncio.sleep(3)
            if self.is_logged_in:
                break
            if self.login_started_at and time.time() - self.login_started_at > 120:
                _LOGGER.warning("2FA login challenge timed out after 2 minutes")
                self.status_message = "Login challenge timed out (2 minutes expired). Please start a new login."
                self.last_error = "Authentication timed out. The 2FA confirmation window has expired."
                break
            token = await self.auth_helper.extract_token_from_cookies()
            if token:
                is_valid = await self.verify_token_validity(token)
                if is_valid:
                    await self.save_session(token)
                    _LOGGER.info("App approval detected! Session saved successfully.")
                    break

    async def submit_2fa(self, code: str) -> Dict[str, Any]:
        """Submit 2FA code or check In-App approval via CDP."""
        async with self._lock:
            try:
                # Check if 120s timeout passed
                if self.login_started_at and (time.time() - self.login_started_at > 120):
                    self.status_message = "Login challenge timed out (2 minutes expired). Please start a new login."
                    self.last_error = "Authentication timed out. The 2FA confirmation window has expired."
                    return {
                        "success": False,
                        "error": "Authentication request expired (2 minutes exceeded). Please start a new login.",
                    }

                clean_code = (code or "").strip()
                if clean_code:
                    await self.auth_helper.submit_2fa_code(clean_code)

                for _ in range(6):
                    await asyncio.sleep(1.5)
                    token = await self.auth_helper.extract_token_from_cookies()
                    if token:
                        is_valid = await self.verify_token_validity(token)
                        if is_valid:
                            await self.save_session(token)
                            return {
                                "success": True,
                                "session_token": token,
                                "message": "Login successful! Session token active.",
                            }

                if clean_code:
                    return {"success": False, "error": "2FA code submitted. Verification in progress or invalid code."}
                return {
                    "success": False,
                    "error": "In-App approval not yet confirmed. Please tap Confirm in your Trade Republic smartphone app and retry.",
                }
            except Exception as e:
                return {"success": False, "error": str(e)}

    async def refresh_session(self) -> Optional[str]:
        """Perform active page interaction and token extraction to keep session alive."""
        async with self._lock:
            try:
                # 1. First check if current session token is still valid via WebSocket
                if self.session_token:
                    is_valid = await self.verify_token_validity(self.session_token)
                    if is_valid:
                        self.is_logged_in = True
                        self.last_error = None
                        self.status_message = "Everything is connected and running normally. Session renewed 24/7."
                        return self.session_token

                # 2. If token check was negative, try gentle in-page interaction (no blind hard reload)
                touch_script = """
                (() => {
                    try {
                        window.dispatchEvent(new Event('mousemove'));
                        window.dispatchEvent(new Event('focus'));
                        if (document.body) {
                            document.body.dispatchEvent(new Event('click'));
                        }
                    } catch(e) {}
                })()
                """
                await self.cdp.send_cmd("Runtime.evaluate", {"expression": touch_script})
                await asyncio.sleep(1)

                token = await self.auth_helper.extract_token_from_cookies()
                if token and token != self.session_token:
                    is_valid = await self.verify_token_validity(token)
                    if is_valid:
                        await self.save_session(token)
                        return token

                # 3. Only if token is definitely invalid after interaction, mark expired
                if self.session_token:
                    is_still_valid = await self.verify_token_validity(self.session_token)
                    if not is_still_valid:
                        _LOGGER.warning("Trade Republic WebSocket rejected session token")
                        self.is_logged_in = False
                        self.status_message = "Session token expired. Please re-authenticate."
                        self.last_error = (
                            "Session expired or rejected by Trade Republic (HTTP 401). Please re-authenticate."
                        )
                        return None

                return self.session_token
            except Exception as e:
                _LOGGER.debug("Session refresh attempt info: %s", e)
            return self.session_token

    async def _keepalive_loop(self) -> None:
        """Run periodic keepalive every 5 minutes with Chromium watchdog."""
        while True:
            await asyncio.sleep(KEEP_ALIVE_INTERVAL)
            try:
                # Watchdog: restart Chromium if crashed
                if self.proc is not None and self.proc.poll() is not None:
                    _LOGGER.warning("Chromium process died (exit code %s), restarting...", self.proc.poll())
                    try:
                        self.proc.wait(timeout=2)
                    except Exception:  # noqa: BLE001
                        pass
                    user_data_dir = os.path.join(DATA_DIR, "chromium_profile")
                    cmd = [
                        "/usr/bin/chromium-browser",
                        "--headless=new",
                        f"--remote-debugging-port={CDP_PORT}",
                        f"--user-data-dir={user_data_dir}",
                        "--no-sandbox",
                        "--disable-setuid-sandbox",
                        "--disable-dev-shm-usage",
                        "--disable-gpu",
                        "--disable-blink-features=AutomationControlled",
                        "--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
                        "https://app.traderepublic.com",
                    ]
                    self.proc = subprocess.Popen(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
                    _LOGGER.info("Chromium restarted, waiting for CDP to become ready...")
                    ready = await self.cdp.wait_for_ready(timeout=20.0)
                    if not ready:
                        _LOGGER.warning("Chromium CDP not ready after restart within 20s")
                    # Reload session from disk after restart
                    if self.session_token:
                        await self._load_saved_session()
                    return

                _LOGGER.debug("24/7 Keepalive running to refresh session...")
                new_token = await self.refresh_session()
                if new_token:
                    await self.save_session(new_token)
                else:
                    _LOGGER.warning("Keepalive: session refresh returned no valid token — session marked as expired")
            except Exception as e:
                _LOGGER.debug("Keepalive error: %s", e)

    async def close(self) -> None:
        if self._keepalive_task:
            self._keepalive_task.cancel()
        if self.proc:
            self.proc.terminate()


browser_service = TradeRepublicBrowserService()
