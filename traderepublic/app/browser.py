import asyncio
import json
import logging
import os
import subprocess
import time
from typing import Any, Dict, Optional

import aiohttp

_LOGGER = logging.getLogger(__name__)

DATA_DIR = os.getenv("DATA_DIR", "/data")
STORAGE_STATE_PATH = os.path.join(DATA_DIR, "browser_cookies.json")
SESSION_FILE_PATH = os.path.join(DATA_DIR, "session.json")
CDP_PORT = 9222


class TradeRepublicBrowserService:
    def __init__(self) -> None:
        self.proc: Optional[subprocess.Popen] = None
        self.is_logged_in: bool = False
        self.session_token: Optional[str] = None
        self.phone_number: Optional[str] = None
        self.status_message: str = "App started. Ready for login."
        self._lock = asyncio.Lock()
        self._keepalive_task: Optional[asyncio.Task] = None
        self._ws_url: Optional[str] = None

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
            await asyncio.sleep(2)

            await self._load_saved_session()
            self._keepalive_task = asyncio.create_task(self._keepalive_loop())
        except Exception as e:
            _LOGGER.error("Failed to start browser process: %s", e)
            self.status_message = f"Error starting browser: {e}"

    async def _send_cdp_cmd(self, method: str, params: Optional[Dict[str, Any]] = None) -> Any:
        """Send command via Chrome DevTools Protocol."""
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(f"http://127.0.0.1:{CDP_PORT}/json") as resp:
                    pages = await resp.json()
                    if not pages:
                        return None
                    ws_url = pages[0].get("webSocketDebuggerUrl")
                    if not ws_url:
                        return None

            import websockets

            async with websockets.connect(ws_url) as ws:
                msg_id = int(time.time() * 1000) % 100000
                req = {"id": msg_id, "method": method, "params": params or {}}
                await ws.send(json.dumps(req))
                while True:
                    raw = await ws.recv()
                    data = json.loads(raw)
                    if data.get("id") == msg_id:
                        return data.get("result")
        except Exception as e:
            _LOGGER.debug("CDP command %s failed: %s", method, e)
            return None

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
        except Exception as e:
            _LOGGER.error("Failed to save session: %s", e)

    async def extract_token_from_cookies(self) -> Optional[str]:
        """Extract tr_session cookie from Chromium via CDP."""
        res = await self._send_cdp_cmd(
            "Network.getCookies", {"urls": ["https://app.traderepublic.com", "https://traderepublic.com"]}
        )
        if res and "cookies" in res:
            for cookie in res["cookies"]:
                if cookie.get("name") == "tr_session":
                    token = cookie.get("value")
                    if token:
                        await self.save_session(token)
                        return token
        return None

    async def start_login(self, phone: str, pin: str) -> Dict[str, Any]:
        """Navigate and input credentials via CDP Runtime evaluation."""
        async with self._lock:
            try:
                self.phone_number = phone
                self.status_message = "Navigating to Trade Republic login..."
                await self._send_cdp_cmd("Page.navigate", {"url": "https://app.traderepublic.com/login"})
                await asyncio.sleep(3)

                # Solve & evaluate input in browser
                js_script = f"""
                (() => {{
                    const phoneInput = document.querySelector('input[name="phoneNumber"], input[type="tel"]');
                    if (phoneInput) {{
                        phoneInput.value = "{phone}";
                        phoneInput.dispatchEvent(new Event('input', {{ bubbles: true }}));
                        phoneInput.dispatchEvent(new Event('change', {{ bubbles: true }}));
                    }}
                    const btn = document.querySelector('button[type="submit"]');
                    if (btn) btn.click();
                    return !!phoneInput;
                }})()
                """
                await self._send_cdp_cmd("Runtime.evaluate", {"expression": js_script})
                await asyncio.sleep(2)

                # Enter PIN if available
                pin_script = f"""
                (() => {{
                    const pinInput = document.querySelector('input[type="password"], input[name="pin"]');
                    if (pinInput) {{
                        pinInput.value = "{pin}";
                        pinInput.dispatchEvent(new Event('input', {{ bubbles: true }}));
                        pinInput.dispatchEvent(new Event('change', {{ bubbles: true }}));
                        const btn = document.querySelector('button[type="submit"]');
                        if (btn) btn.click();
                        return true;
                    }}
                    return false;
                }})()
                """
                await self._send_cdp_cmd("Runtime.evaluate", {"expression": pin_script})

                self.status_message = "Credentials submitted. 2FA (SMS/App approval) required."
                # Launch background task to poll for cookie when user clicks confirm in the TR app
                asyncio.create_task(self._poll_for_app_approval())

                return {
                    "success": True,
                    "step": "2fa_required",
                    "message": "Please enter the 2FA code or confirm in the Trade Republic app.",
                }
            except Exception as e:
                _LOGGER.error("Login init error: %s", e)
                return {"success": False, "error": str(e)}

    async def _poll_for_app_approval(self) -> None:
        """Poll for session token in background for 90s after credentials submission."""
        for _ in range(30):
            await asyncio.sleep(3)
            if self.is_logged_in:
                break
            token = await self.extract_token_from_cookies()
            if token:
                _LOGGER.info("App approval detected! Session saved successfully.")
                break

    async def submit_2fa(self, code: str) -> Dict[str, Any]:
        """Submit 2FA code via CDP."""
        async with self._lock:
            try:
                code_script = f"""
                (() => {{
                    const otp = document.querySelector('input[name="code"], input[type="number"], input[autocomplete="one-time-code"]');
                    if (otp) {{
                        otp.value = "{code}";
                        otp.dispatchEvent(new Event('input', {{ bubbles: true }}));
                        otp.dispatchEvent(new Event('change', {{ bubbles: true }}));
                        const btn = document.querySelector('button[type="submit"]');
                        if (btn) btn.click();
                        return true;
                    }}
                    return false;
                }})()
                """
                await self._send_cdp_cmd("Runtime.evaluate", {"expression": code_script})

                for _ in range(8):
                    await asyncio.sleep(2)
                    token = await self.extract_token_from_cookies()
                    if token:
                        return {"success": True, "session_token": token, "message": "Login successful!"}

                return {"success": False, "error": "2FA code submitted. Check Trade Republic app approval if required."}
            except Exception as e:
                return {"success": False, "error": str(e)}

    async def refresh_session(self) -> Optional[str]:
        async with self._lock:
            try:
                await self._send_cdp_cmd("Page.reload", {})
                await asyncio.sleep(3)
                token = await self.extract_token_from_cookies()
                if token:
                    return token
            except Exception as e:
                _LOGGER.warning("Session refresh failed: %s", e)
            return self.session_token

    async def _keepalive_loop(self) -> None:
        interval = int(os.getenv("KEEP_ALIVE_INTERVAL", "600"))
        while True:
            await asyncio.sleep(interval)
            if self.is_logged_in:
                _LOGGER.debug("Keepalive refreshing session...")
                await self.refresh_session()

    async def close(self) -> None:
        if self._keepalive_task:
            self._keepalive_task.cancel()
        if self.proc:
            self.proc.terminate()


browser_service = TradeRepublicBrowserService()
