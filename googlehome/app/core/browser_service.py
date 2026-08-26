import asyncio
import logging
import os
import subprocess
import time
from typing import Any, Callable, Dict, Optional

from .cdp import CDPClient
from .constants import CDP_PORT, DATA_DIR, USER_AGENT

_LOGGER = logging.getLogger(__name__)


class GoogleHomeBrowserService:
    """Automates Chromium for Google EmbeddedSetup and 2FA authentication."""

    def __init__(self) -> None:
        self.cdp = CDPClient(CDP_PORT)
        self.proc: Optional[subprocess.Popen] = None
        self.auth_in_progress: bool = False
        self.auth_step: str = "idle"
        self.auth_error: Optional[str] = None
        self.two_factor_data: Dict[str, Any] = {}
        self._auth_task: Optional[asyncio.Task] = None
        self._target_email: Optional[str] = None
        self._on_success_callback: Optional[Callable[[str, str], None]] = None

    def set_on_success_callback(self, cb: Callable[[str, str], None]) -> None:
        """Set callback to invoke when token is acquired."""
        self._on_success_callback = cb

    async def start_chromium(self) -> None:
        """Launch headless Chromium with remote debugging."""
        if self.proc is not None and self.proc.poll() is None:
            return

        os.makedirs(DATA_DIR, exist_ok=True)
        user_data_dir = os.path.join(DATA_DIR, "chromium_profile")
        os.makedirs(user_data_dir, exist_ok=True)

        chromium_bin = "/usr/bin/chromium-browser"
        if not os.path.exists(chromium_bin):
            chromium_bin = "/usr/bin/chromium"
        if not os.path.exists(chromium_bin):
            chromium_bin = "chromium"

        cmd = [
            chromium_bin,
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

        try:
            _LOGGER.info("Launching headless Chromium via CDP (%s)...", chromium_bin)
            self.proc = subprocess.Popen(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            ready = await self.cdp.wait_for_ready(timeout=15.0)
            if ready:
                _LOGGER.info("Chromium CDP ready on port %d", CDP_PORT)
            else:
                _LOGGER.warning("Chromium CDP was not ready within 15s")
        except Exception as err:
            _LOGGER.warning("Could not start Chromium process: %s", err)

    async def start_auth_flow(self, email: str, password: str) -> None:
        """Start the automated login sequence on accounts.google.com/EmbeddedSetup."""
        if self._auth_task and not self._auth_task.done():
            self._auth_task.cancel()

        self.auth_in_progress = True
        self.auth_step = "starting"
        self.auth_error = None
        self.two_factor_data = {}
        self._target_email = email.strip()

        await self.start_chromium()

        self._auth_task = asyncio.create_task(self._run_auth_sequence(email.strip(), password.strip()))

    async def submit_2fa_code(self, code: str) -> bool:
        """Submit 2FA verification code (SMS or TOTP)."""
        clean_code = code.strip()
        _LOGGER.info("Submitting 2FA verification code to Google...")
        script = f"""
        (() => {{
            const inputs = document.querySelectorAll('input[type="tel"], input[type="text"], input[name="Pin"], #idvPin, #totpPin, input[name="totpPin"], input[autocomplete="one-time-code"]');
            for (const input of inputs) {{
                if (input && input.offsetParent !== null) {{
                    input.focus();
                    input.value = '{clean_code}';
                    input.dispatchEvent(new Event('input', {{ bubbles: true }}));
                    input.dispatchEvent(new Event('change', {{ bubbles: true }}));
                    break;
                }}
            }}
            const btns = document.querySelectorAll('#idvPreregisteredPhoneNext button, #totpNext button, button[type="button"], button[type="submit"], div[role="button"]');
            for (const b of btns) {{
                const text = (b.innerText || b.value || '').toLowerCase();
                if (text.includes('next') || text.includes('weiter') || text.includes('submit') || text.includes('verify') || text.includes('bestätigen') || text.includes('senden')) {{
                    b.click();
                    return true;
                }}
            }}
            return false;
        }})();
        """
        res = await self.cdp.send_cmd("Runtime.evaluate", {"expression": script, "returnByValue": True})
        return bool(res and res.get("value"))

    async def cancel_auth(self) -> None:
        """Cancel ongoing authentication flow."""
        if self._auth_task and not self._auth_task.done():
            self._auth_task.cancel()
        self.auth_in_progress = False
        self.auth_step = "idle"
        self.auth_error = "Authentication cancelled"
        await self.cdp.send_cmd("Page.navigate", {"url": "about:blank"})

    async def _run_auth_sequence(self, email: str, password: str) -> None:
        """Internal async sequence for Google login."""
        try:
            self.auth_step = "navigating"
            _LOGGER.info("Navigating to Google EmbeddedSetup...")
            await self.cdp.send_cmd("Page.navigate", {"url": "https://accounts.google.com/EmbeddedSetup"})
            await asyncio.sleep(3.0)

            # 1. Fill Email
            self.auth_step = "filling_email"
            _LOGGER.info("Filling email: %s", email)
            fill_email_script = f"""
            (() => {{
                const el = document.querySelector('input[type="email"], #identifierId, input[name="identifier"]');
                if (el) {{
                    el.focus();
                    el.value = '{email}';
                    el.dispatchEvent(new Event('input', {{ bubbles: true }}));
                    el.dispatchEvent(new Event('change', {{ bubbles: true }}));
                    const nextBtn = document.querySelector('#identifierNext button, #identifierNext, button[type="button"], div[role="button"]');
                    if (nextBtn) {{
                        nextBtn.click();
                        return true;
                    }}
                }}
                return false;
            }})();
            """
            filled_email = False
            for _ in range(12):
                res = await self.cdp.send_cmd(
                    "Runtime.evaluate", {"expression": fill_email_script, "returnByValue": True}
                )
                if res and res.get("value"):
                    filled_email = True
                    break
                await asyncio.sleep(0.5)

            if not filled_email:
                _LOGGER.warning("Could not find email input field on Google signin page")

            await asyncio.sleep(3.0)

            # Check for email errors
            email_err = await self._check_page_error()
            if email_err:
                self.auth_step = "error"
                self.auth_error = f"Google email error: {email_err}"
                self.auth_in_progress = False
                _LOGGER.error("Google rejected email: %s", email_err)
                return

            # 2. Fill Password
            self.auth_step = "filling_password"
            _LOGGER.info("Filling password...")
            fill_pwd_script = f"""
            (() => {{
                const el = document.querySelector('input[type="password"], input[name="Passwd"], input[name="password"]');
                if (el) {{
                    el.focus();
                    el.value = '{password}';
                    el.dispatchEvent(new Event('input', {{ bubbles: true }}));
                    el.dispatchEvent(new Event('change', {{ bubbles: true }}));
                    const nextBtn = document.querySelector('#passwordNext button, #passwordNext, button[type="button"], div[role="button"]');
                    if (nextBtn) {{
                        nextBtn.click();
                        return true;
                    }}
                }}
                return false;
            }})();
            """
            filled_pwd = False
            for _ in range(12):
                res = await self.cdp.send_cmd(
                    "Runtime.evaluate", {"expression": fill_pwd_script, "returnByValue": True}
                )
                if res and res.get("value"):
                    filled_pwd = True
                    break
                await asyncio.sleep(0.5)

            if not filled_pwd:
                _LOGGER.warning("Could not find password input field on Google signin page")

            await asyncio.sleep(3.5)

            # Check for password errors
            pwd_err = await self._check_page_error()
            if pwd_err:
                self.auth_step = "error"
                self.auth_error = f"Google password error: {pwd_err}"
                self.auth_in_progress = False
                _LOGGER.error("Google rejected password: %s", pwd_err)
                return

            # 3. Monitor Loop for 2FA or cookie completion (up to 120s)
            deadline = time.monotonic() + 120
            while time.monotonic() < deadline:
                # Check for completion cookie
                oauth_token = await self._extract_oauth_cookie()
                if oauth_token:
                    self.auth_step = "exchanging"
                    _LOGGER.info("Extracted oauth_token cookie from browser, exchanging...")
                    await self._complete_token_exchange(email, oauth_token)
                    return

                # Check for on-page errors
                page_err = await self._check_page_error()
                if page_err and "challenge" not in page_err.lower() and "verify" not in page_err.lower():
                    self.auth_step = "error"
                    self.auth_error = f"Google authentication error: {page_err}"
                    self.auth_in_progress = False
                    _LOGGER.error("Google page error during 2FA: %s", page_err)
                    return

                # Detect 2FA Challenge
                challenge = await self._detect_2fa_challenge()
                if challenge:
                    ctype = challenge.get("type")
                    if ctype == "prompt":
                        self.auth_step = "2fa_prompt"
                        self.two_factor_data = challenge
                    elif ctype in ("sms", "totp", "code"):
                        self.auth_step = "2fa_code"
                        self.two_factor_data = challenge
                    else:
                        self.auth_step = "2fa_general"
                        self.two_factor_data = challenge

                await asyncio.sleep(1.5)

            self.auth_step = "error"
            self.auth_error = "Authentication timed out (120s)"
            self.auth_in_progress = False
        except asyncio.CancelledError:
            self.auth_in_progress = False
            self.auth_step = "idle"
        except Exception as err:
            _LOGGER.exception("Error in Google Auth Sequence: %s", err)
            self.auth_step = "error"
            self.auth_error = str(err)
            self.auth_in_progress = False

    async def _check_page_error(self) -> Optional[str]:
        """Check for Google error elements in DOM."""
        check_err_script = r"""
        (() => {
            const err = document.querySelector('div[aria-live="assertive"], div[jsname="B1fBne"], span[jsslot]');
            if (err && err.innerText && err.innerText.trim().length > 3) {
                return err.innerText.trim();
            }
            return null;
        })();
        """
        res = await self.cdp.send_cmd("Runtime.evaluate", {"expression": check_err_script, "returnByValue": True})
        if res and isinstance(res.get("value"), str):
            val = res["value"].strip()
            if len(val) > 3:
                return val
        return None

    async def _detect_2fa_challenge(self) -> Optional[Dict[str, Any]]:
        """Scan DOM for Google 2FA challenge markers."""
        check_script = r"""
        (() => {
            const bodyText = document.body ? document.body.innerText : '';

            // 1. Phone Prompt (Number tap)
            const numberEl = document.querySelector('div[data-challengeinfo], div[jsname="r4nke"], span[jsname="V67aGc"], div.hK3Xcf');
            if (numberEl && numberEl.innerText && /^\d{1,3}$/.test(numberEl.innerText.trim())) {
                return { type: 'prompt', number: numberEl.innerText.trim(), text: bodyText.substring(0, 300) };
            }

            const match = bodyText.match(/(?:tippe|tap|number|zahl|select)\s*(?:auf|on)?\s*[:\s]*(\d{1,3})/i);
            if (match) {
                return { type: 'prompt', number: match[1], text: bodyText.substring(0, 300) };
            }

            // 2. SMS / Phone code
            const smsInput = document.querySelector('input[type="tel"], input[name="Pin"], #idvPin, #idvanyphonecollectNext input');
            if (smsInput && smsInput.offsetParent !== null) {
                return { type: 'sms', title: 'SMS Verification', text: bodyText.substring(0, 300) };
            }

            // 3. Authenticator App (TOTP)
            const totpInput = document.querySelector('#totpPin, input[name="totpPin"], input[autocomplete="one-time-code"]');
            if (totpInput && totpInput.offsetParent !== null) {
                return { type: 'totp', title: 'Authenticator App', text: bodyText.substring(0, 300) };
            }

            // 4. Passkey / Security Key prompt - if "Try another way" exists, click it!
            const btns = document.querySelectorAll('button, div[role="button"], a');
            for (const el of btns) {
                const t = (el.innerText || '').toLowerCase();
                if (t.includes('try another way') || t.includes('andere option') || t.includes('andere methode')) {
                    el.click();
                    break;
                }
            }

            if (window.location.href.includes('challenge') || window.location.href.includes('signin/v2')) {
                return { type: 'general', title: 'Google Security Verification', text: bodyText.substring(0, 300) };
            }

            return null;
        })();
        """
        res = await self.cdp.send_cmd("Runtime.evaluate", {"expression": check_script, "returnByValue": True})
        if res and isinstance(res.get("value"), dict):
            return res["value"]
        return None

    async def _extract_oauth_cookie(self) -> Optional[str]:
        """Check for oauth_token cookie on accounts.google.com."""
        res = await self.cdp.send_cmd(
            "Network.getCookies", {"urls": ["https://accounts.google.com", "https://google.com"]}
        )
        if res and "cookies" in res:
            for cookie in res["cookies"]:
                if cookie.get("name") == "oauth_token":
                    val = cookie.get("value", "")
                    if val.startswith("oauth2_4/") or len(val) > 20:
                        return val
        return None

    async def _complete_token_exchange(self, email: str, oauth_token: str) -> None:
        """Exchange oauth_token for Master Token via gpsoauth."""
        try:
            from gpsoauth import exchange_token

            res = exchange_token(email, oauth_token, "android-701ab861a7be")
            if "Token" in res:
                master_token = res["Token"]
                if self._on_success_callback:
                    self._on_success_callback(email, master_token)

                self.auth_step = "success"
                self.auth_in_progress = False
                _LOGGER.info("Master Token successfully generated via 2FA headless flow for %s", email)
            else:
                err_code = res.get("Error", "ExchangeFailed")
                self.auth_step = "error"
                self.auth_error = f"Google token exchange error: {err_code}"
                self.auth_in_progress = False
        except Exception as err:
            _LOGGER.exception("Token exchange failed: %s", err)
            self.auth_step = "error"
            self.auth_error = str(err)
            self.auth_in_progress = False
