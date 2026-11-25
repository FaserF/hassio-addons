import asyncio
import contextlib
import logging
import os
import subprocess
import time
from typing import Any

from core.auth import AuthHelper
from core.cdp import CDPClient
from core.constants import CDP_PORT, DATA_DIR, KEEP_ALIVE_INTERVAL, USER_AGENT
from core.session_manager import SessionManager
from core.verifier import verify_tr_token
from core.ws_keeper import TRWebSocketKeeper

_LOGGER = logging.getLogger(__name__)
_AUTH_EXPIRED_MSG = "Session expired or rejected by Trade Republic (HTTP 401). Please re-authenticate."


def _normalize_phone(phone: str) -> str:
    raw = (phone or "").strip().replace(" ", "").replace("-", "").replace("/", "")
    if raw.startswith("00"):
        return "+" + raw[2:]
    if raw.startswith("+"):
        return raw
    if raw.startswith("0") and len(raw) >= 9:
        return "+49" + raw[1:]
    return "+" + raw


class TradeRepublicBrowserService:
    """Orchestrates Chromium, Session Persistence, Authentication, and 24/7 Keepalive."""

    def __init__(self) -> None:
        self.cdp = CDPClient(CDP_PORT)
        self.session_manager = SessionManager()
        self.auth_helper = AuthHelper(self.cdp)

        self.proc: subprocess.Popen | None = None
        self._is_logged_in_override: bool | None = None
        self.session_token: str | None = None
        self.phone_number: str | None = None
        self.status_message: str = "App started. Ready for login."
        self.last_sync_time: float | None = None
        self.last_error: str | None = None
        self.client_requests_count: int = 0
        self.token_verified_at: float | None = None
        self.last_login_time: float | None = None
        self.last_token_update_time: float | None = None
        self.last_logout_time: float | None = None
        self.last_logout_reason: str | None = None
        self.last_session_duration: float | None = None
        self.last_interaction_type: str = "None"
        self.last_interaction_details: str = "No interactions yet"
        self.request_counts_by_type: dict[str, int] = {"data": 0, "session": 0, "refresh": 0, "status": 0}

        self._lock = asyncio.Lock()
        self._keepalive_task: asyncio.Task | None = None
        self._approval_poll_task: asyncio.Task | None = None
        self._qr_poll_task: asyncio.Task | None = None
        self._qr_polling_active: bool = False
        self.login_started_at: float | None = None
        self._last_invalidated_token: str | None = None

        self._ws_keeper = TRWebSocketKeeper(
            token_factory=lambda: self.session_token,
            on_auth_lost_callback=self._on_ws_auth_lost,
            on_token_refresh=self._on_ws_token_refresh,
        )

    @property
    def is_logged_in(self) -> bool:
        """Dynamic login status driven by persistent keeper."""
        if self._is_logged_in_override is not None:
            return self._is_logged_in_override
        return bool(getattr(self, "_ws_keeper", None) and self._ws_keeper.is_authenticated)

    @is_logged_in.setter
    def is_logged_in(self, value: bool) -> None:
        self._is_logged_in_override = value

    @property
    def is_login_in_progress(self) -> bool:
        """True while an interactive login/2FA flow is active."""
        return bool(self.login_started_at and not self.is_logged_in and (time.time() - self.login_started_at) < 120)

    def _build_chromium_cmd(self, start_url: str = "about:blank") -> list[str]:
        user_data_dir = os.path.join(DATA_DIR, "chromium_profile")
        os.makedirs(user_data_dir, exist_ok=True)
        return [
            "/usr/bin/chromium-browser",
            "--headless=new",
            f"--remote-debugging-port={CDP_PORT}",
            f"--user-data-dir={user_data_dir}",
            "--no-sandbox",
            "--disable-setuid-sandbox",
            "--disable-dev-shm-usage",
            "--disable-gpu",
            "--disable-software-rasterizer",
            "--disable-extensions",
            "--disable-background-networking",
            "--disable-default-apps",
            "--disable-sync",
            "--mute-audio",
            "--no-first-run",
            "--disable-blink-features=AutomationControlled",
            f"--user-agent={USER_AGENT}",
            start_url,
        ]

    async def start(self) -> None:
        """Start headless Chromium with remote debugging port."""
        try:
            os.makedirs(DATA_DIR, exist_ok=True)
            _LOGGER.info("Launching headless Chromium via CDP...")
            self.proc = subprocess.Popen(
                self._build_chromium_cmd("about:blank"), stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL
            )
            if not await self.cdp.wait_for_ready(timeout=20.0):
                _LOGGER.warning("Chromium CDP not ready within 20s — proceeding anyway")
            else:
                try:
                    await self.cdp.send_cmd("Page.enable")
                    await self.cdp.send_cmd("Network.enable")
                    await self.cdp.send_cmd(
                        "Page.addScriptToEvaluateOnNewDocument",
                        {"source": "Object.defineProperty(navigator, 'webdriver', {get: () => undefined})"},
                    )
                except Exception as cdp_init_err:  # noqa: BLE001
                    _LOGGER.debug("Could not run initial CDP setup: %s", cdp_init_err)

            await self._load_saved_session()
            self._ws_keeper.start()
            self._keepalive_task = asyncio.create_task(self._keepalive_loop())
            asyncio.create_task(self._startup_validation())
        except Exception as e:
            _LOGGER.error("Failed to start browser process: %s", e)
            self.status_message = f"Error starting browser: {e}"

    async def _on_ws_auth_lost(self, reason: str = "") -> None:
        """Handle permanent auth loss (HTTP 401) from WS keeper without retry loops."""
        if not self.last_logout_time:
            logout_now = time.time()
            dur = (logout_now - self.last_login_time) if self.last_login_time else None
            self.last_logout_time = logout_now
            self.last_session_duration = dur
            self.last_logout_reason = reason or _AUTH_EXPIRED_MSG
            self.session_manager.record_logout(
                self.last_logout_reason, self.last_session_duration, logout_time=self.last_logout_time
            )
        self.is_logged_in = False
        self.status_message = "Session token expired. Please re-authenticate."
        self.last_error = reason or self.last_logout_reason or _AUTH_EXPIRED_MSG
        if not self.is_login_in_progress and not self._lock.locked():
            with contextlib.suppress(Exception):
                await self.cdp.send_cmd("Page.navigate", {"url": "about:blank"})

    async def _startup_validation(self) -> None:
        """Confirm keeper authenticated after startup or mark expired cleanly."""
        await asyncio.sleep(20)
        if self._ws_keeper.is_authenticated:
            self._is_logged_in_override = None
            self.last_error = None
            self.status_message = "Everything is connected and running normally."
            return

        if (
            self._ws_keeper.last_error
            and "401" in self._ws_keeper.last_error
            and self._is_logged_in_override is not False
        ):
            _LOGGER.info("Startup validation: keeper reported 401 — attempting single browser rotation...")
            rotated = await self._on_ws_token_refresh()
            if rotated:
                _LOGGER.info("Startup validation: successfully rotated token via browser!")
                self._ws_keeper.update_token(rotated)
                self._is_logged_in_override = None
                self.last_error = None
                self.status_message = "Everything is connected and running normally."
                return
            _LOGGER.warning("Startup validation: saved session token rejected by TR (401) — marking expired")
            await self._on_ws_auth_lost(self._ws_keeper.last_error)

    async def verify_token_validity(self, token: str) -> bool:
        """Check token validity via the keeper's persistent connection state."""
        if not token or not self._ws_keeper.is_authenticated:
            return False
        self.token_verified_at = time.time()
        return True

    async def _load_saved_session(self) -> None:
        data = self.session_manager.load()
        if not data:
            return
        self.session_token = data.get("session_token")
        self.phone_number = data.get("phone_number")
        if updated_at := data.get("updated_at"):
            self.last_token_update_time = float(updated_at)
            self.last_login_time = data.get("last_login_time", float(updated_at))
        self.last_logout_time = data.get("last_logout_time")
        self.last_logout_reason = data.get("last_logout_reason")
        self.last_session_duration = data.get("last_session_duration")
        if self.session_token:
            await self.auth_helper.inject_session_cookies(self.session_token)
            self.status_message = "Validating Trade Republic connection..."
            self.last_error = None
            _LOGGER.info("Loaded session token from disk — keeper will verify connection shortly")

    async def save_session(
        self, token: str, phone: str | None = None, is_new_login: bool = False, notify_keeper: bool = True
    ) -> None:
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
        self.last_session_duration = None
        self.status_message = "Everything is connected and running normally. Re-login is only required if your session expires or if you experience connection issues."
        self.last_error = None
        self.session_manager.save(
            clean_tok,
            self.phone_number,
            login_time=self.last_login_time,
            logout_time=None,
            logout_reason=None,
            duration_seconds=None,
        )
        await self.auth_helper.inject_session_cookies(clean_tok)
        if notify_keeper:
            self._ws_keeper.update_token(clean_tok)

    def _cancel_poll_tasks(self, exclude_current: bool = True) -> None:
        current_task = asyncio.current_task() if exclude_current else None
        for attr in ("_approval_poll_task", "_qr_poll_task"):
            task = getattr(self, attr, None)
            if task and not task.done() and task is not current_task:
                task.cancel()
            if task is not current_task:
                setattr(self, attr, None)
        self._qr_polling_active = False

    async def _finalize_login(self, token: str, source: str) -> None:
        """Persist verified login idempotently and wait briefly for WS keeper handshake."""
        clean_tok = token.strip().strip('"').strip("'")
        if self.is_logged_in and self.session_token == clean_tok:
            _LOGGER.debug("Login already finalized; skipping duplicate finalize from %s", source)
            return
        self.login_started_at = None
        self._cancel_poll_tasks(exclude_current=True)
        await self.save_session(clean_tok, is_new_login=True, notify_keeper=True)
        await self._ws_keeper.wait_until_connected(timeout=6.0)
        _LOGGER.info("Login finalized via %s (ws_authenticated=%s)", source, self._ws_keeper.is_authenticated)

    async def _navigate_and_extract_token(self) -> str | None:
        """Navigate Chromium to TR web app with current cookies and extract any rotated token."""
        if not self.cdp or not self.session_token:
            return None
        await self.auth_helper.inject_session_cookies(self.session_token)
        await self.cdp.send_cmd("Page.navigate", {"url": "https://app.traderepublic.com"})
        await asyncio.sleep(5)
        await self.cdp.send_cmd(
            "Runtime.evaluate",
            {"expression": "window.dispatchEvent(new Event('focus')); window.dispatchEvent(new Event('mousemove'));"},
        )
        await asyncio.sleep(2)
        new_token = await self.auth_helper.extract_token_from_cookies()
        if new_token and new_token != self.session_token and await verify_tr_token(new_token):
            return new_token
        return None

    async def _on_ws_token_refresh(self) -> str | None:
        """Attempt immediate browser navigation and token extraction when WS gets 401."""
        if not self.cdp or self._lock.locked() or self.is_login_in_progress or not self.session_token:
            return None
        async with self._lock:
            try:
                _LOGGER.info("Browser Service: rotating token via Chromium on WS 401...")
                new_token = await self._navigate_and_extract_token()
                if new_token:
                    _LOGGER.info("Browser Service: successfully extracted and verified rotated token")
                    await self.save_session(new_token, notify_keeper=False)
                    return new_token
            except Exception as e:
                _LOGGER.debug("Browser Service: token rotation error: %s", e)
        return None

    async def start_login(self, phone: str, pin: str) -> dict[str, Any]:
        """Navigate and input credentials via CDP + trigger push/SMS."""
        async with self._lock:
            try:
                clean_phone = _normalize_phone(phone)
                digits_only = "".join(filter(str.isdigit, clean_phone))
                if not clean_phone.startswith("+") or not (7 <= len(digits_only) <= 15):
                    return {
                        "success": False,
                        "error": "Invalid international phone number. Please include your country code (e.g. +49..., +33..., +34..., +43..., +41..., +31...).",
                    }

                clean_pin = (pin or "").strip()
                if not clean_pin.isdigit() or not (4 <= len(clean_pin) <= 6):
                    return {"success": False, "error": "Invalid PIN. PIN must be 4 to 6 digits (numbers only)."}

                self._cancel_poll_tasks(exclude_current=True)
                self.phone_number = clean_phone
                self.is_logged_in = False
                self._last_invalidated_token = self.session_token
                self.session_token = None
                self.login_started_at = time.time()
                self._ws_keeper.stop(shutdown=False)

                try:
                    await self.cdp.send_cmd("Network.clearBrowserCookies", {})
                    clear_storage = (
                        "(() => { try { ['sessionToken','tr_session','tr_session_id','auth_token']"
                        ".forEach(k => { localStorage.removeItem(k); sessionStorage.removeItem(k); }); } catch(e) {} })()"
                    )
                    await self.cdp.send_cmd("Runtime.evaluate", {"expression": clear_storage})
                except Exception as clear_err:  # noqa: BLE001
                    _LOGGER.debug("Could not clear cookies before login: %s", clear_err)

                self.status_message = "Navigating to Trade Republic login..."
                login_res = await self.auth_helper.execute_login(clean_phone, clean_pin)
                if not login_res.get("success"):
                    err_msg = login_res.get("error") or login_res.get("message") or "Login rejected by Trade Republic."
                    self.status_message = f"Login failed: {err_msg}"
                    self.last_error = err_msg
                    self.login_started_at = None
                    return {"success": False, "error": err_msg, "message": self.status_message}

                self.status_message = login_res.get("message", "Credentials submitted. Please confirm on smartphone.")
                self._approval_poll_task = asyncio.create_task(self._poll_for_app_approval())
                return {
                    "success": True,
                    "step": "2fa_required",
                    "flow": login_res.get("flow", "confirmInApp"),
                    "message": self.status_message,
                }
            except Exception as e:
                _LOGGER.error("Login init error: %s", e)
                return {"success": False, "error": f"Internal browser error: {e}"}

    async def get_qr_code(self, force_refresh: bool = False) -> dict[str, Any]:
        """Navigate to login, ensure QR challenge is present and extract it."""
        async with self._lock:
            try:
                if self.is_logged_in and not force_refresh:
                    return {"success": False, "qr_code": None, "is_logged_in": True}
                if self.is_login_in_progress and not force_refresh:
                    return {"success": False, "qr_code": None, "is_logged_in": False, "login_in_progress": True}

                url_res = await self.cdp.send_cmd(
                    "Runtime.evaluate", {"expression": "window.location.href", "returnByValue": True}
                )
                current_url = url_res and url_res.get("result", {}).get("value", "")
                if force_refresh or "login" not in str(current_url):
                    _LOGGER.info("Navigating to Trade Republic login page for fresh QR code...")
                    await self.cdp.send_cmd("Page.navigate", {"url": "https://app.traderepublic.com/login"})
                    await asyncio.sleep(3.0)

                banner_script = (
                    "(() => { const b = Array.from(document.querySelectorAll('button')).find(x => x.textContent && "
                    "(x.textContent.includes('Accept') || x.textContent.includes('Akzeptieren') || x.textContent.includes('Allow'))); "
                    "if (b) b.click(); })()"
                )
                await self.cdp.send_cmd("Runtime.evaluate", {"expression": banner_script})

                qr_data = await self.auth_helper.extract_qr_code()
                if qr_data and not self._qr_polling_active:
                    self._qr_polling_active = True
                    self._qr_poll_task = asyncio.create_task(self._poll_for_qr_approval())

                return {"success": bool(qr_data), "qr_code": qr_data, "is_logged_in": self.is_logged_in}
            except Exception as e:
                _LOGGER.debug("Error getting QR code: %s", e)
                return {"success": False, "error": str(e), "qr_code": None}

    async def _poll_for_qr_approval(self) -> None:
        """Poll in background for successful QR code scan without racing submit_2fa."""
        try:
            invalid_tokens = {self._last_invalidated_token} if self._last_invalidated_token else set()
            for _ in range(60):
                await asyncio.sleep(3)
                if self.is_logged_in or self.is_login_in_progress:
                    break
                if self._lock.locked():
                    continue
                async with self._lock:
                    if self.is_logged_in or self.is_login_in_progress:
                        break
                    token = await self.auth_helper.extract_token_from_cookies()
                    if not token or token in invalid_tokens:
                        continue
                    if await verify_tr_token(token):
                        await self._finalize_login(token, "qr_poller")
                        break
                    invalid_tokens.add(token)
        except asyncio.CancelledError:
            return
        except Exception as e:
            _LOGGER.debug("Error in QR approval poller: %s", e)
        finally:
            self._qr_polling_active = False

    async def _poll_for_app_approval(self) -> None:
        """Poll for session token in background for 120s after credentials submission."""
        try:
            invalid_tokens = {self._last_invalidated_token} if self._last_invalidated_token else set()
            for _ in range(40):
                await asyncio.sleep(3)
                if self.is_logged_in:
                    break
                if self.login_started_at and time.time() - self.login_started_at > 120:
                    _LOGGER.warning("2FA login challenge timed out after 2 minutes")
                    self.status_message = "Login challenge timed out (2 minutes expired). Please start a new login."
                    self.last_error = "Authentication timed out. The 2FA confirmation window has expired."
                    break
                if self._lock.locked():
                    continue
                async with self._lock:
                    if self.is_logged_in:
                        break
                    token = await self.auth_helper.extract_token_from_cookies()
                    if not token or token in invalid_tokens:
                        continue
                    if await verify_tr_token(token):
                        await self._finalize_login(token, "app_poller")
                        break
                    invalid_tokens.add(token)
        except asyncio.CancelledError:
            return
        except Exception as e:
            _LOGGER.debug("Error in app approval poller: %s", e)

    async def submit_2fa(self, code: str) -> dict[str, Any]:
        """Submit 2FA code or check In-App approval via CDP."""
        async with self._lock:
            try:
                if self.is_logged_in and self.session_token:
                    await self._ws_keeper.wait_until_connected(timeout=5.0)
                    return {
                        "success": True,
                        "session_token": self.session_token,
                        "message": "Login successful! Session token active.",
                    }
                if self.login_started_at and (time.time() - self.login_started_at > 120):
                    self.status_message = "Login challenge timed out (2 minutes expired). Please start a new login."
                    self.last_error = "Authentication timed out. The 2FA confirmation window has expired."
                    return {
                        "success": False,
                        "error": "Authentication request expired (2 minutes exceeded). Please start a new login.",
                    }

                invalid_tokens = {self._last_invalidated_token} if self._last_invalidated_token else set()
                clean_code = (code or "").strip()
                if clean_code:
                    await self.auth_helper.submit_2fa_code(clean_code)

                for _ in range(4):
                    await asyncio.sleep(1.0)
                    token = await self.auth_helper.extract_token_from_cookies()
                    if not token or token in invalid_tokens:
                        continue
                    if await verify_tr_token(token):
                        await self._finalize_login(token, "submit_2fa")
                        return {
                            "success": True,
                            "session_token": token,
                            "message": "Login successful! Session token active.",
                        }
                    invalid_tokens.add(token)

                if clean_code:
                    return {"success": False, "error": "2FA code submitted. Verification in progress or invalid code."}
                return {
                    "success": False,
                    "error": "In-App approval not yet confirmed. Please tap Confirm in your Trade Republic smartphone app and retry.",
                }
            except Exception as e:
                return {"success": False, "error": str(e)}

    async def refresh_session(self) -> str | None:
        """Sync keeper auth state or attempt a single Chromium rotation if auth failed."""
        async with self._lock:
            try:
                if self._ws_keeper.is_authenticated:
                    self.is_logged_in = True
                    self.token_verified_at = time.time()
                    self.last_error = None
                    self.status_message = "Everything is connected and running normally. Session renewed."
                    return self.session_token

                if not self.session_token or self._is_logged_in_override is False or not self._ws_keeper._running:
                    return None

                _LOGGER.debug("WS Keeper not authenticated — actively rotating session in Chromium...")
                try:
                    if browser_token := await self._navigate_and_extract_token():
                        _LOGGER.info("Extracted and verified new token from Chromium cookies, updating session")
                        await self.save_session(browser_token, notify_keeper=True)
                        return browser_token
                except Exception as rot_e:
                    _LOGGER.debug("Active rotation in refresh_session failed: %s", rot_e)

                if self._ws_keeper.last_error and "401" in self._ws_keeper.last_error:
                    await self._on_ws_auth_lost(self._ws_keeper.last_error)
                    return None
                return self.session_token
            except Exception as e:
                _LOGGER.debug("Session refresh attempt info: %s", e)
            return self.session_token

    async def _keepalive_loop(self) -> None:
        """Chromium watchdog and keeper state sync loop."""
        while True:
            await asyncio.sleep(KEEP_ALIVE_INTERVAL)
            try:
                if self.proc is not None and self.proc.poll() is not None:
                    _LOGGER.warning("Chromium process died (exit code %s), restarting...", self.proc.poll())
                    with contextlib.suppress(Exception):
                        self.proc.wait(timeout=2)
                    self.proc = subprocess.Popen(
                        self._build_chromium_cmd("about:blank"), stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL
                    )
                    if not await self.cdp.wait_for_ready(timeout=20.0):
                        _LOGGER.warning("Chromium CDP not ready after restart within 20s")

                if (
                    not self.session_token
                    or self._is_logged_in_override is False
                    or not self._ws_keeper._running
                    or self.is_login_in_progress
                ):
                    _LOGGER.debug("Keepalive: no active session — skipping TR network activity")
                    continue

                token_age = time.time() - (self.last_token_update_time or self.last_login_time or 0)
                needs_refresh = ((not self._ws_keeper.is_authenticated) and self.last_login_time is not None) or (
                    token_age > 1800
                )

                if needs_refresh and not self._lock.locked():
                    async with self._lock:
                        try:
                            _LOGGER.debug("Keepalive: refreshing web session via Chromium (age: %ss)", int(token_age))
                            if new_token := await self._navigate_and_extract_token():
                                _LOGGER.info(
                                    "Keepalive: renewed session token from Chromium (length: %s)", len(new_token)
                                )
                                await self.save_session(new_token, notify_keeper=True)
                            else:
                                self.last_token_update_time = time.time()
                        except Exception as renew_err:  # noqa: BLE001
                            _LOGGER.debug("Keepalive token rotation attempt: %s", renew_err)

                await self.refresh_session()
            except asyncio.CancelledError:
                break
            except Exception as e:
                _LOGGER.debug("Keepalive error: %s", e)

    async def close(self) -> None:
        """Shut down keeper, tasks, CDP HTTP session, and Chromium process cleanly."""
        self._ws_keeper.stop(shutdown=True)
        self._cancel_poll_tasks(exclude_current=False)
        if self._keepalive_task:
            self._keepalive_task.cancel()
        await self.cdp.close()
        if self.proc:
            self.proc.terminate()
            try:
                self.proc.wait(timeout=3)
            except Exception:  # noqa: BLE001
                self.proc.kill()


browser_service = TradeRepublicBrowserService()
