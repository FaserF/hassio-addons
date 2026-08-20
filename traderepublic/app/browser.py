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
        self.last_sync_time: Optional[float] = None
        self.last_error: Optional[str] = None
        self.client_requests_count: int = 0
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
                    if self.session_token:
                        # Verify whether token is actually accepted by Trade Republic
                        is_valid = await self.verify_token_validity(self.session_token)
                        self.is_logged_in = is_valid
                        if is_valid:
                            self.status_message = "Everything is connected and running normally."
                            self.last_error = None
                        else:
                            self.status_message = "Stored session token is expired. Please re-authenticate."
                            self.last_error = "Session expired or rejected by Trade Republic (HTTP 401). Please click Re-authenticate."
            except Exception as e:
                _LOGGER.warning("Failed to load session file: %s", e)

    async def verify_token_validity(self, token: str) -> bool:
        """Verify token against Trade Republic WebSocket backend."""
        if not token:
            return False
        clean_token = token.strip().strip('"').strip("'")
        if clean_token.lower().startswith("bearer "):
            clean_token = clean_token[7:].strip()

        try:
            import ssl

            import websockets

            ssl_ctx = ssl.create_default_context()
            headers = {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
                "Origin": "https://app.traderepublic.com",
                "Cookie": f"tr_session={clean_token}; sessionToken={clean_token}",
            }
            async with (
                asyncio.timeout(5),
                websockets.connect("wss://api.traderepublic.com", ssl=ssl_ctx, additional_headers=headers) as ws,
            ):
                handshake = {
                    "locale": "de",
                    "platformId": "web",
                    "appVersion": "4.120.0",
                    "osVersion": "10.0.0",
                    "token": clean_token,
                }
                await ws.send("connect 26 " + json.dumps(handshake))
                resp = await ws.recv()
                if resp and "connected" in str(resp):
                    return True
                return False

        except Exception as e:
            _LOGGER.debug("Token validation check error: %s", e)
            return False

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
            _LOGGER.info("Session saved successfully (token length: %s)", len(clean_tok))
        except Exception as e:
            _LOGGER.error("Failed to save session: %s", e)

    async def extract_token_from_cookies(self) -> Optional[str]:
        """Extract valid JWT session token from Chromium via CDP cookies and storage."""
        # 1. Check CDP Network Cookies across all URLs / domains
        for cdp_method, params in [
            (
                "Network.getCookies",
                {
                    "urls": [
                        "https://app.traderepublic.com",
                        "https://traderepublic.com",
                        "https://api.traderepublic.com",
                    ]
                },
            ),
            ("Storage.getCookies", {}),
        ]:
            res = await self._send_cdp_cmd(cdp_method, params)
            if res and "cookies" in res:
                for cookie in res["cookies"]:
                    cname = cookie.get("name", "")
                    if cname in ("tr_session", "sessionToken", "tr_session_id", "auth_token"):
                        token = cookie.get("value")
                        if token and (token.startswith("eyJ") or len(token) > 40):
                            await self.save_session(token)
                            return token

        # 2. Check localStorage & sessionStorage across window & frames
        storage_script = """
        (() => {
            try {
                // Check all keys in localStorage
                for (let i = 0; i < localStorage.length; i++) {
                    const k = localStorage.key(i);
                    const v = localStorage.getItem(k);
                    if (v && typeof v === 'string') {
                        if (k === 'sessionToken' || k === 'tr_session' || k.includes('session') || k.includes('auth')) {
                            // Check if raw token or JSON stringified
                            try {
                                const parsed = JSON.parse(v);
                                if (typeof parsed === 'string' && (parsed.startsWith('eyJ') || parsed.length > 30)) return parsed;
                                if (parsed && typeof parsed === 'object') {
                                    if (parsed.sessionToken) return parsed.sessionToken;
                                    if (parsed.token) return parsed.token;
                                }
                            } catch(e) {}
                            if (v.startsWith('eyJ') || v.length > 30) return v;
                        }
                    }
                }
                // Check sessionStorage
                for (let i = 0; i < sessionStorage.length; i++) {
                    const k = sessionStorage.key(i);
                    const v = sessionStorage.getItem(k);
                    if (v && typeof v === 'string' && (v.startsWith('eyJ') || v.length > 30)) return v;
                }
            } catch(e) {}
            return null;
        })()
        """
        storage_res = await self._send_cdp_cmd(
            "Runtime.evaluate", {"expression": storage_script, "returnByValue": True}
        )
        if storage_res and isinstance(storage_res, dict):
            val = storage_res.get("result", {}).get("value")
            if val and isinstance(val, str) and (val.startswith("eyJ") or len(val) > 30):
                clean_val = val.strip().strip('"').strip("'")
                await self.save_session(clean_val)
                return clean_val

        # 3. Check document.cookie via Runtime evaluation
        eval_script = """
        (() => {
            const match = document.cookie.match(/(?:tr_session|sessionToken)=([^;]+)/);
            if (match && match[1] && (match[1].startsWith('eyJ') || match[1].length > 30)) return match[1];
            return null;
        })()
        """
        eval_res = await self._send_cdp_cmd("Runtime.evaluate", {"expression": eval_script, "returnByValue": True})
        if eval_res and isinstance(eval_res, dict):
            val = eval_res.get("result", {}).get("value")
            if val and isinstance(val, str) and (val.startswith("eyJ") or len(val) > 30):
                clean_val = val.strip().strip('"').strip("'")
                await self.save_session(clean_val)
                return clean_val

        return None

    async def get_waf_token(self) -> Optional[str]:
        """Extract AWS WAF token from browser cookies if solved."""
        res = await self._send_cdp_cmd(
            "Network.getCookies",
            {"urls": ["https://app.traderepublic.com", "https://traderepublic.com", "https://api.traderepublic.com"]},
        )
        if res and "cookies" in res:
            for cookie in res["cookies"]:
                if "aws-waf" in cookie.get("name", "").lower():
                    return cookie.get("value")
        return None

    async def start_login(self, phone: str, pin: str) -> Dict[str, Any]:
        """Navigate and input credentials via CDP + direct API fallback with AWS WAF token."""
        async with self._lock:
            try:
                # Normalize phone number to strict international E.164 format (+<country_code><number>)
                raw_phone = (phone or "").strip().replace(" ", "").replace("-", "").replace("/", "")
                if raw_phone.startswith("00"):
                    clean_phone = "+" + raw_phone[2:]
                elif raw_phone.startswith("+"):
                    clean_phone = raw_phone
                elif raw_phone.startswith("0") and len(raw_phone) >= 9:
                    # National leading zero without country prefix (default to DE/AT/CH +49 or user context)
                    clean_phone = "+49" + raw_phone[1:]
                else:
                    clean_phone = "+" + raw_phone

                # International phone validation check (E.164: + followed by 7 to 15 digits)
                digits_only = "".join(filter(str.isdigit, clean_phone))
                if not clean_phone.startswith("+") or not (7 <= len(digits_only) <= 15):
                    return {
                        "success": False,
                        "error": "Invalid international phone number. Please include your country code (e.g. +49..., +33..., +34..., +43..., +41..., +31...).",
                    }

                clean_pin = (pin or "").strip()
                # PIN validation check: must be 4-6 digits, only numbers
                if not clean_pin.isdigit() or not (4 <= len(clean_pin) <= 6):
                    return {"success": False, "error": "Invalid PIN. PIN must be 4 to 6 digits (numbers only)."}

                self.phone_number = clean_phone
                self.is_logged_in = False
                self.session_token = None

                self.status_message = "Navigating to Trade Republic login..."
                await self._send_cdp_cmd("Page.navigate", {"url": "https://app.traderepublic.com/login"})
                await asyncio.sleep(4)

                # Step 0: Dismiss cookie banners
                banner_script = """
                (() => {
                    const btns = Array.from(document.querySelectorAll('button'));
                    const acceptBtn = btns.find(b => b.textContent && (b.textContent.includes('Accept') || b.textContent.includes('Akzeptieren') || b.textContent.includes('Allow')));
                    if (acceptBtn) { acceptBtn.click(); return true; }
                    return false;
                })()
                """
                await self._send_cdp_cmd("Runtime.evaluate", {"expression": banner_script})
                await asyncio.sleep(1)

                # Step 1: React Native Setter & Dispatch for Phone Number
                phone_script = f"""
                (() => {{
                    const input = document.querySelector('input[name="phoneNumber"], input[type="tel"], input[autocomplete="tel"], input');
                    if (input) {{
                        input.focus();
                        const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
                        nativeSetter.call(input, "{clean_phone}");
                        input.dispatchEvent(new Event('input', {{ bubbles: true }}));
                        input.dispatchEvent(new Event('change', {{ bubbles: true }}));
                        input.dispatchEvent(new KeyboardEvent('keydown', {{ key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }}));

                        const btn = document.querySelector('button[type="submit"], button[data-testid="login-submit-button"]');
                        if (btn) btn.click();
                        return true;
                    }}
                    return false;
                }})()
                """
                await self._send_cdp_cmd("Runtime.evaluate", {"expression": phone_script})
                await asyncio.sleep(3)

                # Step 2: React Native Setter & Dispatch for PIN
                pin_script = f"""
                (() => {{
                    const input = document.querySelector('input[type="password"], input[name="pin"], input[name="password"]');
                    if (input) {{
                        input.focus();
                        const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
                        nativeSetter.call(input, "{clean_pin}");
                        input.dispatchEvent(new Event('input', {{ bubbles: true }}));
                        input.dispatchEvent(new Event('change', {{ bubbles: true }}));
                        input.dispatchEvent(new KeyboardEvent('keydown', {{ key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }}));
                        const btn = document.querySelector('button[type="submit"], button[data-testid="login-submit-button"]');
                        if (btn) btn.click();
                        return true;
                    }}
                    return false;
                }})()
                """
                await self._send_cdp_cmd(
                    "Runtime.evaluate", {"expression": pin_script, "returnByValue": True}
                )

                # Step 3: Direct API Request to Trade Republic Authentication Backend
                api_feedback_msg = None
                try:
                    waf_token = await self.get_waf_token()
                    headers = {
                        "Content-Type": "application/json",
                        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
                    }
                    if waf_token:
                        headers["X-aws-waf-token"] = waf_token

                    async with (
                        aiohttp.ClientSession() as session,
                        session.post(
                            "https://api.traderepublic.com/api/v2/auth/web/login",
                            json={"phoneNumber": clean_phone, "pin": clean_pin},
                            headers=headers,
                            timeout=aiohttp.ClientTimeout(total=8),
                        ) as resp,
                    ):
                        resp_text = await resp.text()

                        _LOGGER.info("Trade Republic Auth API response [HTTP %s]: %s", resp.status, resp_text)
                        if resp.status == 200:
                            data = json.loads(resp_text)
                            api_feedback_msg = f"Push notification dispatched (Process ID: {data.get('processId', 'active')}). Please confirm in Trade Republic app."
                        elif resp.status in (400, 401):
                            try:
                                err_data = json.loads(resp_text)
                                if (
                                    "errors" in err_data
                                    and isinstance(err_data["errors"], list)
                                    and len(err_data["errors"]) > 0
                                ):
                                    first_err = err_data["errors"][0]
                                    err_code = first_err.get("errorCode", "")
                                    err_msg = first_err.get("errorMessage", "")
                                    if err_code == "NUMBER_INVALID":
                                        api_feedback_msg = "Invalid phone number or country code format."
                                    elif err_code == "PIN_INVALID":
                                        api_feedback_msg = "Invalid PIN. Please check your PIN."
                                    else:
                                        api_feedback_msg = f"{err_code}: {err_msg}" if err_msg else err_code
                                else:
                                    err_title = err_data.get("error") or err_data.get("message") or resp_text
                                    api_feedback_msg = f"Trade Republic Server: {err_title}"
                            except Exception:
                                api_feedback_msg = f"Trade Republic Server Error (HTTP {resp.status})"

                        elif resp.status == 403:
                            api_feedback_msg = "Trade Republic WAF Protection: Solving Bot Challenge, please wait..."
                except Exception as api_err:  # noqa: BLE001
                    _LOGGER.warning("Direct Auth API attempt info: %s", api_err)

                # Check if Trade Republic page displays any inline error messages
                dom_error_script = """
                (() => {
                    const errEl = document.querySelector('[role="alert"], [data-testid="error-message"], .error, .alert');
                    if (errEl && errEl.textContent) return errEl.textContent.trim();
                    return null;
                })()
                """
                dom_err = await self._send_cdp_cmd(
                    "Runtime.evaluate", {"expression": dom_error_script, "returnByValue": True}
                )
                dom_err_text = dom_err and dom_err.get("result", {}).get("value")

                final_msg = (
                    dom_err_text
                    or api_feedback_msg
                    or "Credentials submitted. Please confirm in your Trade Republic smartphone app."
                )
                self.status_message = final_msg
                asyncio.create_task(self._poll_for_app_approval())

                return {
                    "success": True,
                    "step": "2fa_required",
                    "message": final_msg,
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
            token = await self.extract_token_from_cookies()
            if token:
                _LOGGER.info("App approval detected! Session saved successfully.")
                break

    async def submit_2fa(self, code: str) -> Dict[str, Any]:
        """Submit 2FA code or check In-App approval via CDP."""
        async with self._lock:
            try:
                clean_code = (code or "").strip()
                if clean_code:
                    code_script = f"""
                    (() => {{
                        const otp = document.querySelector('input[name="code"], input[type="number"], input[autocomplete="one-time-code"], input[data-testid="otp-input"]');
                        if (otp) {{
                            otp.focus();
                            otp.value = "{clean_code}";
                            otp.dispatchEvent(new Event('input', {{ bubbles: true }}));
                            otp.dispatchEvent(new Event('change', {{ bubbles: true }}));
                            const btn = document.querySelector('button[type="submit"], button[data-testid="login-submit-button"]');
                            if (btn) btn.click();
                            return true;
                        }}
                        return false;
                    }})()
                    """
                    await self._send_cdp_cmd("Runtime.evaluate", {"expression": code_script})

                # Check for session token (whether from code or smartphone app approval)
                for _ in range(6):
                    await asyncio.sleep(1.5)
                    token = await self.extract_token_from_cookies()
                    if token:
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
