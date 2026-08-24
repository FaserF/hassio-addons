import asyncio
import logging
import os
import subprocess
import time
from typing import Any, Dict, Optional

from core.auth import AuthHelper
from core.cdp import CDPClient
from core.constants import CDP_PORT, DATA_DIR, KEEP_ALIVE_INTERVAL, USER_AGENT
from core.session_manager import SessionManager
from core.ws_keeper import TRWebSocketKeeper

_LOGGER = logging.getLogger(__name__)


class TradeRepublicBrowserService:
    """Orchestrates Chromium, Session Persistence, Authentication, and 24/7 Keepalive."""

    def __init__(self) -> None:
        self.cdp = CDPClient(CDP_PORT)
        self.session_manager = SessionManager()
        self.auth_helper = AuthHelper(self.cdp)

        self.proc: Optional[subprocess.Popen] = None
        self._is_logged_in_override: Optional[bool] = None
        self.session_token: Optional[str] = None
        self.phone_number: Optional[str] = None
        self.status_message: str = "App started. Ready for login."
        self.last_sync_time: Optional[float] = None
        self.last_error: Optional[str] = None
        self.client_requests_count: int = 0
        self.token_verified_at: Optional[float] = None
        self.last_login_time: Optional[float] = None
        self.last_token_update_time: Optional[float] = None
        self.last_logout_time: Optional[float] = None
        self.last_logout_reason: Optional[str] = None
        self.last_session_duration: Optional[float] = None
        self.last_interaction_type: str = "None"
        self.last_interaction_details: str = "No interactions yet"
        self.request_counts_by_type: dict[str, int] = {
            "data": 0,
            "session": 0,
            "refresh": 0,
            "status": 0,
        }

        self._lock = asyncio.Lock()
        self._keepalive_task: Optional[asyncio.Task] = None
        self.login_started_at: Optional[float] = None

        # Persistent WebSocket keeper — one connection, always alive
        self._ws_keeper = TRWebSocketKeeper(token_factory=lambda: self.session_token)

    @property
    def is_logged_in(self) -> bool:
        """Dynamic login status driven by persistent keeper."""
        if self._is_logged_in_override is not None:
            return self._is_logged_in_override
        if getattr(self, "_ws_keeper", None) and self._ws_keeper.is_authenticated:
            return True
        return False

    @is_logged_in.setter
    def is_logged_in(self, value: bool) -> None:
        self._is_logged_in_override = value

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
                f"--user-agent={USER_AGENT}",
                "about:blank",
            ]
            _LOGGER.info("Launching headless Chromium via CDP...")
            self.proc = subprocess.Popen(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

            ready = await self.cdp.wait_for_ready(timeout=20.0)
            if not ready:
                _LOGGER.warning("Chromium CDP not ready within 20s — proceeding anyway")

            await self._load_saved_session()
            if self.session_token:
                # Pre-Keeper Token Refresh:
                # Navigate Chromium to establish browser session and rotate/renew token before WS connect.
                try:
                    _LOGGER.info("Startup: navigating to app.traderepublic.com to rotate session token...")
                    await self.auth_helper.inject_session_cookies(self.session_token)
                    await self.cdp.send_cmd("Page.navigate", {"url": "https://app.traderepublic.com"})
                    await asyncio.sleep(5)

                    refreshed = await self.auth_helper.extract_token_from_cookies()
                    if refreshed:
                        from core.verifier import verify_tr_token

                        if await verify_tr_token(refreshed):
                            _LOGGER.info("Startup: successfully validated/rotated session token from Chromium")
                            await self.save_session(refreshed)
                except Exception as nav_err:  # noqa: BLE001
                    _LOGGER.debug("Startup navigation info: %s", nav_err)

            # Start persistent WS keeper and Chromium watchdog
            self._ws_keeper.start()
            self._keepalive_task = asyncio.create_task(self._keepalive_loop())
            # Validate token after startup — keeper has had time to connect by then
            asyncio.create_task(self._startup_validation())
        except Exception as e:
            _LOGGER.error("Failed to start browser process: %s", e)
            self.status_message = f"Error starting browser: {e}"

    async def _startup_validation(self) -> None:
        """Wait briefly, then confirm keeper actually authenticated.

        The session is loaded optimistically on disk. If the saved token is
        expired, the keeper will get a 401 within seconds. This task detects
        that and marks the session as expired so the HA integration
        shows the correct status.
        """
        await asyncio.sleep(15)
        if self._ws_keeper.is_authenticated:
            self._is_logged_in_override = None
            self.last_error = None
            self.status_message = "Everything is connected and running normally."
            return

        if not self._ws_keeper.is_authenticated:
            # If the keeper explicitly got a 401, mark expired
            if self._ws_keeper.last_error and "401" in self._ws_keeper.last_error:
                _LOGGER.warning("Startup validation: saved session token rejected by TR (401) — marking expired")
                import time

                logout_now = time.time()
                dur = (logout_now - self.last_login_time) if self.last_login_time else self.last_session_duration
                self.last_logout_time = logout_now
                self.last_logout_reason = "Add-on Restart / Update"
                if dur is not None:
                    self.last_session_duration = dur
                self.session_manager.record_logout(
                    self.last_logout_reason,
                    self.last_session_duration,
                    logout_time=self.last_logout_time,
                )
                self.is_logged_in = False
                self.status_message = (
                    "Stored session token expired due to Add-on Restart / Update. Please re-authenticate."
                )
                self.last_error = self.last_logout_reason or "Add-on Restart / Update"

    async def verify_token_validity(self, token: str) -> bool:
        """Check token validity via the keeper's persistent connection state.

        We no longer open a new WebSocket just to verify — instead we rely on
        the keeper's connection state. If the keeper is connected and authenticated,
        the token is valid. This avoids the repeated open/close pattern that
        caused TR to detect bot activity and invalidate sessions.
        """
        if not token:
            return False
        if self._ws_keeper.is_authenticated:
            self.token_verified_at = time.time()
            return True
        # Keeper not yet connected or rejected — fall back to one-off check
        # only on startup (when keeper hasn't had time to connect yet)
        from core.verifier import verify_tr_token

        is_valid = await verify_tr_token(token)
        if is_valid:
            self.token_verified_at = time.time()
        return is_valid

    async def _load_saved_session(self) -> None:
        data = self.session_manager.load()
        if data:
            self.session_token = data.get("session_token")
            self.phone_number = data.get("phone_number")
            updated_at = data.get("updated_at")
            if updated_at:
                self.last_token_update_time = float(updated_at)
                self.last_login_time = data.get("last_login_time", float(updated_at))
            self.last_logout_time = data.get("last_logout_time")
            self.last_logout_reason = data.get("last_logout_reason")
            self.last_session_duration = data.get("last_session_duration")
            if self.session_token:
                # Inject cookies into Chromium immediately so the page stays authenticated
                await self.auth_helper.inject_session_cookies(self.session_token)
                self.status_message = "Validating Trade Republic connection..."
                self.last_error = None
                _LOGGER.info("Loaded session token from disk — keeper will verify connection shortly")

    async def save_session(
        self,
        token: str,
        phone: Optional[str] = None,
        is_new_login: bool = False,
    ) -> None:
        import time

        if not token:
            _LOGGER.warning("Attempted to save empty session token")
            return
        clean_tok = token.strip().strip('"').strip("'")
        self.session_token = clean_tok
        if phone:
            self.phone_number = phone
        self.is_logged_in = True
        self.last_token_update_time = time.time()
        if is_new_login or not self.last_login_time:
            self.last_login_time = time.time()
        self.last_logout_time = None
        self.last_logout_reason = None
        self.status_message = "Everything is connected and running normally. Re-login is only required if your session expires or if you experience connection issues."
        self.last_error = None
        self.session_manager.save(
            clean_tok,
            self.phone_number,
            login_time=self.last_login_time,
        )
        await self.auth_helper.inject_session_cookies(clean_tok)
        # Tell keeper about the new token so it reconnects if previously stopped
        self._ws_keeper.update_token(clean_tok)

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
                self._last_invalidated_token = self.session_token
                self.session_token = None
                self.login_started_at = time.time()

                # Stop the persistent WS connection so TR doesn't see an active
                # session — otherwise TR suppresses the push notification to the app.
                self._ws_keeper.stop()

                # Clear stale session cookies from Chromium so that
                # _poll_for_app_approval won't find and re-verify the old expired token
                try:
                    await self.cdp.send_cmd("Network.clearBrowserCookies", {})
                    clear_storage_script = """
                    (() => {
                        try {
                            ['sessionToken','tr_session','tr_session_id','auth_token'].forEach(k => {
                                localStorage.removeItem(k);
                                sessionStorage.removeItem(k);
                            });
                        } catch(e) {}
                    })()
                    """
                    await self.cdp.send_cmd("Runtime.evaluate", {"expression": clear_storage_script})
                    _LOGGER.debug("Cleared stale session cookies before login")
                except Exception as clear_err:  # noqa: BLE001
                    _LOGGER.debug("Could not clear cookies before login: %s", clear_err)

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
        from core.verifier import verify_tr_token

        # Remember the old token so we don't treat old cookies as new login
        invalid_tokens = set()
        if getattr(self, "_last_invalidated_token", None):
            invalid_tokens.add(self._last_invalidated_token)

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
            if not token:
                continue
            # Skip any known invalid / previous tokens
            if token in invalid_tokens:
                continue
            # New token appeared — verify it once via direct WS check
            is_valid = await verify_tr_token(token)
            if is_valid:
                await self.save_session(token, is_new_login=True)
                self._ws_keeper.start()
                _LOGGER.info("App approval detected! Session saved and WS keeper restarted.")
                break
            else:
                # Token present but invalid — record so we don't re-check it
                invalid_tokens.add(token)

    async def submit_2fa(self, code: str) -> Dict[str, Any]:
        """Submit 2FA code or check In-App approval via CDP."""
        from core.verifier import verify_tr_token

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
                        # Keeper is stopped during login — use one-off verifier
                        is_valid = await verify_tr_token(token)
                        if is_valid:
                            await self.save_session(token, is_new_login=True)
                            self._ws_keeper.start()
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
                # The ws_keeper handles continuous token validation.
                # Here we just sync its state into browser_service and optionally
                # attempt to refresh the token from Chromium cookies if the keeper
                # has detected an auth failure.
                if self._ws_keeper.is_authenticated:
                    import time

                    self.is_logged_in = True
                    self.token_verified_at = time.time()
                    self.last_error = None
                    self.status_message = "Everything is connected and running normally. Session renewed."
                    return self.session_token

                # Keeper detected auth failure — try to extract and verify a fresh token from browser
                _LOGGER.info("WS Keeper not authenticated — attempting token extraction from Chromium")
                browser_token = await self.auth_helper.extract_token_from_cookies()
                if browser_token and browser_token != self.session_token:
                    from core.verifier import verify_tr_token

                    is_valid = await verify_tr_token(browser_token)
                    if is_valid:
                        _LOGGER.info("Extracted and verified new token from Chromium cookies, updating session")
                        await self.save_session(browser_token)
                        self._ws_keeper.start()
                        return browser_token
                    _LOGGER.warning("Extracted token from Chromium cookies is invalid or rejected")

                # If keeper explicitly got a 401, mark session as expired
                if self._ws_keeper.last_error and "401" in self._ws_keeper.last_error:
                    if self.is_logged_in or not self.last_logout_time:
                        import time

                        logout_now = time.time()
                        dur = (logout_now - self.last_login_time) if self.last_login_time else None
                        self.last_logout_time = logout_now
                        self.last_logout_reason = self._ws_keeper.last_error
                        if dur is not None:
                            self.last_session_duration = dur
                        self.session_manager.record_logout(self.last_logout_reason, self.last_session_duration)
                    self.is_logged_in = False
                    self.status_message = "Session token expired. Please re-authenticate."
                    self.last_error = (
                        "Session expired or rejected by Trade Republic (HTTP 401). Please re-authenticate."
                    )
                    return None

                # Keeper is still connecting — optimistically keep current state
                return self.session_token
            except Exception as e:
                _LOGGER.debug("Session refresh attempt info: %s", e)
            return self.session_token

    async def _keepalive_loop(self) -> None:
        """Chromium watchdog and keeper state sync loop."""
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
                        f"--user-agent={USER_AGENT}",
                        "https://app.traderepublic.com",
                    ]
                    self.proc = subprocess.Popen(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
                    _LOGGER.info("Chromium restarted, waiting for CDP to become ready...")
                    ready = await self.cdp.wait_for_ready(timeout=20.0)
                    if not ready:
                        _LOGGER.warning("Chromium CDP not ready after restart within 20s")
                # Active token auto-renewal:
                # Trade Republic Web JWTs expire after ~60 minutes unless refreshed via the web app.
                # Navigate Chromium in background to app.traderepublic.com so TR rotates/renews the session cookies.
                if self.is_logged_in and self.session_token:
                    try:
                        import time

                        _LOGGER.debug("Keepalive: refreshing web session via Chromium navigation")
                        await self.cdp.send_cmd("Page.navigate", {"url": "https://app.traderepublic.com"})
                        await asyncio.sleep(4)
                        new_token = await self.auth_helper.extract_token_from_cookies()
                        if new_token and new_token != self.session_token:
                            from core.verifier import verify_tr_token

                            if await verify_tr_token(new_token):
                                _LOGGER.info(
                                    "Keepalive: successfully renewed session token from Chromium (length: %s)",
                                    len(new_token),
                                )
                                await self.save_session(new_token)
                        else:
                            # Token confirmed fresh and valid via active page load
                            self.last_token_update_time = time.time()
                    except Exception as renew_err:  # noqa: BLE001
                        _LOGGER.debug("Keepalive token rotation attempt: %s", renew_err)

                # Sync keeper auth state into service state
                _LOGGER.debug("Keepalive: syncing ws_keeper state (authenticated=%s)", self._ws_keeper.is_authenticated)
                await self.refresh_session()

            except Exception as e:
                _LOGGER.debug("Keepalive error: %s", e)

    async def close(self) -> None:
        self._ws_keeper.stop()
        if self._keepalive_task:
            self._keepalive_task.cancel()
        if self.proc:
            self.proc.terminate()


browser_service = TradeRepublicBrowserService()
