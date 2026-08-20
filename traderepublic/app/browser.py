import asyncio
import json
import logging
import os
import time
from typing import Any, Dict, Optional

from playwright.async_api import Browser, BrowserContext, Page, async_playwright

_LOGGER = logging.getLogger(__name__)

DATA_DIR = os.getenv("DATA_DIR", "/data")
STORAGE_STATE_PATH = os.path.join(DATA_DIR, "browser_state.json")
SESSION_FILE_PATH = os.path.join(DATA_DIR, "session.json")


class TradeRepublicBrowserService:
    def __init__(self) -> None:
        self.playwright = None
        self.browser: Optional[Browser] = None
        self.context: Optional[BrowserContext] = None
        self.page: Optional[Page] = None
        self.is_logged_in: bool = False
        self.session_token: Optional[str] = None
        self.phone_number: Optional[str] = None
        self.status_message: str = "Addon started. Ready for login."
        self._lock = asyncio.Lock()
        self._keepalive_task: Optional[asyncio.Task] = None

    async def start(self) -> None:
        """Start Playwright browser."""
        try:
            self.playwright = await async_playwright().start()
            # Launch chromium (using installed alpine chromium if available)
            executable_path = "/usr/bin/chromium-browser" if os.path.exists("/usr/bin/chromium-browser") else None
            self.browser = await self.playwright.chromium.launch(
                headless=True,
                executable_path=executable_path,
                args=[
                    "--no-sandbox",
                    "--disable-setuid-sandbox",
                    "--disable-dev-shm-usage",
                    "--disable-gpu",
                    "--disable-blink-features=AutomationControlled",
                ],
            )

            # Load persistent storage state if exists
            context_kwargs = {
                "user_agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
                "viewport": {"width": 1280, "height": 800},
            }
            if os.path.exists(STORAGE_STATE_PATH):
                try:
                    context_kwargs["storage_state"] = STORAGE_STATE_PATH
                    _LOGGER.info("Loaded previous browser storage state.")
                except Exception as e:
                    _LOGGER.warning("Could not load storage state: %s", e)

            self.context = await self.browser.new_context(**context_kwargs)
            self.page = await self.context.new_page()

            # Attempt to extract session from storage
            await self._load_saved_session()

            # Start keep-alive loop
            self._keepalive_task = asyncio.create_task(self._keepalive_loop())
        except Exception as e:
            _LOGGER.error("Failed to start browser service: %s", e)
            self.status_message = f"Error starting browser: {e}"

    async def _load_saved_session(self) -> None:
        if os.path.exists(SESSION_FILE_PATH):
            try:
                with open(SESSION_FILE_PATH, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    self.session_token = data.get("session_token")
                    self.phone_number = data.get("phone_number")
                    self.is_logged_in = bool(self.session_token)
                    if self.is_logged_in:
                        self.status_message = "Session restored from storage."
            except Exception as e:
                _LOGGER.warning("Failed to load session file: %s", e)

    async def save_session(self, token: str, phone: Optional[str] = None) -> None:
        self.session_token = token
        if phone:
            self.phone_number = phone
        self.is_logged_in = True
        self.status_message = "Logged in and session active."

        os.makedirs(DATA_DIR, exist_ok=True)
        try:
            with open(SESSION_FILE_PATH, "w", encoding="utf-8") as f:
                json.dump(
                    {
                        "session_token": self.session_token,
                        "phone_number": self.phone_number,
                        "updated_at": time.time(),
                    },
                    f,
                    indent=2,
                )
            if self.context:
                await self.context.storage_state(path=STORAGE_STATE_PATH)
        except Exception as e:
            _LOGGER.error("Failed to save session to disk: %s", e)

    async def extract_token_from_cookies(self) -> Optional[str]:
        """Extract tr_session cookie from active browser context."""
        if not self.context:
            return None
        cookies = await self.context.cookies(["https://app.traderepublic.com", "https://traderepublic.com"])
        for cookie in cookies:
            if cookie.get("name") == "tr_session":
                token = cookie.get("value")
                if token:
                    await self.save_session(token)
                    return token
        return None

    async def start_login(self, phone: str, pin: str) -> Dict[str, Any]:
        """Navigate to Trade Republic login page and submit phone & PIN."""
        async with self._lock:
            if not self.page:
                return {"success": False, "error": "Browser not initialized"}
            try:
                self.phone_number = phone
                self.status_message = "Navigating to Trade Republic login..."
                await self.page.goto("https://app.traderepublic.com/login", wait_until="networkidle", timeout=30000)

                # Check for phone input
                phone_input = await self.page.wait_for_selector(
                    "input[name='phoneNumber'], input[type='tel']", timeout=15000
                )
                if not phone_input:
                    return {"success": False, "error": "Phone number field not found"}
                await phone_input.fill(phone)

                # Submit or next
                submit_btn = await self.page.query_selector("button[type='submit']")
                if submit_btn:
                    await submit_btn.click()
                await self.page.wait_for_timeout(2000)

                # Enter PIN if prompted
                pin_input = await self.page.query_selector("input[type='password'], input[name='pin']")
                if pin_input:
                    await pin_input.fill(pin)
                    pin_submit = await self.page.query_selector("button[type='submit']")
                    if pin_submit:
                        await pin_submit.click()

                self.status_message = "Credentials submitted. 2FA (SMS/App approval) required."
                return {
                    "success": True,
                    "step": "2fa_required",
                    "message": "Please enter the 2FA code or confirm in the Trade Republic app.",
                }
            except Exception as e:
                _LOGGER.error("Login initialization error: %s", e)
                self.status_message = f"Login failed: {e}"
                return {"success": False, "error": str(e)}

    async def submit_2fa(self, code: str) -> Dict[str, Any]:
        """Submit the 2FA code in the browser."""
        async with self._lock:
            if not self.page:
                return {"success": False, "error": "Browser not initialized"}
            try:
                otp_input = await self.page.wait_for_selector(
                    "input[name='code'], input[type='number'], input[autocomplete='one-time-code']", timeout=10000
                )
                if otp_input:
                    await otp_input.fill(code)
                    submit_btn = await self.page.query_selector("button[type='submit']")
                    if submit_btn:
                        await submit_btn.click()

                # Wait for navigation / token cookie
                for _ in range(10):
                    await self.page.wait_for_timeout(1500)
                    token = await self.extract_token_from_cookies()
                    if token:
                        return {"success": True, "session_token": token, "message": "Login successful!"}

                return {"success": False, "error": "2FA submitted but token cookie not found yet. Check app approval."}
            except Exception as e:
                _LOGGER.error("2FA submission error: %s", e)
                return {"success": False, "error": str(e)}

    async def refresh_session(self) -> Optional[str]:
        """Reload the app in the browser to trigger WAF token renewal."""
        async with self._lock:
            if not self.page:
                return None
            try:
                self.status_message = "Refreshing session via headless browser..."
                await self.page.goto("https://app.traderepublic.com", wait_until="networkidle", timeout=30000)
                token = await self.extract_token_from_cookies()
                if token:
                    _LOGGER.info("Session successfully refreshed.")
                    return token
            except Exception as e:
                _LOGGER.warning("Failed to refresh session: %s", e)
            return self.session_token

    async def _keepalive_loop(self) -> None:
        """Periodic background refresh to keep the web session active."""
        interval = int(os.getenv("KEEP_ALIVE_INTERVAL", "600"))
        while True:
            await asyncio.sleep(interval)
            if self.is_logged_in and self.page:
                _LOGGER.debug("Running background keep-alive refresh...")
                try:
                    await self.refresh_session()
                except Exception as e:
                    _LOGGER.warning("Keepalive refresh failed: %s", e)

    async def close(self) -> None:
        if self._keepalive_task:
            self._keepalive_task.cancel()
        if self.context:
            await self.context.close()
        if self.browser:
            await self.browser.close()
        if self.playwright:
            await self.playwright.stop()


browser_service = TradeRepublicBrowserService()
