import asyncio
import logging
import os
import subprocess
import time
from typing import Any, Dict, Optional

from .cdp import CDPClient
from .constants import CDP_PORT, DATA_DIR, USER_AGENT

_LOGGER = logging.getLogger(__name__)


class GoogleHomeBrowserService:
    """Automates Chromium for Google EmbeddedSetup and 2FA authentication."""

    def __init__(self) -> None:
        self.cdp = CDPClient(CDP_PORT)
        self.proc: Optional[subprocess.Popen] = None
        self.auth_in_progress: bool = False
        self.auth_step: str = (
            "idle"  # idle, starting, filling_email, filling_password, 2fa_prompt, 2fa_code, exchanging, success, error
        )
        self.auth_error: Optional[str] = None
        self.two_factor_data: Dict[str, Any] = {}
        self._auth_task: Optional[asyncio.Task] = None
        self._target_email: Optional[str] = None
        self._on_success_callback = None

    def set_on_success_callback(self, cb) -> None:
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
        script = f"""
        (() => {{
            const inputs = document.querySelectorAll('input[type="tel"], input[name="Pin"], #idvPin, #totpPin, input[name="totpPin"], input[autocomplete="one-time-code"]');
            for (const input of inputs) {{
                if (input && input.offsetParent !== null) {{
                    input.value = '{clean_code}';
                    input.dispatchEvent(new Event('input', {{ bubbles: true }}));
                    input.dispatchEvent(new Event('change', {{ bubbles: true }}));
                    break;
                }}
            }}
            const btns = document.querySelectorAll('button, div[role="button"], input[type="submit"]');
            for (const b of btns) {{
                const text = (b.innerText || b.value || '').toLowerCase();
                if (text.includes('next') || text.includes('weiter') || text.includes('submit') || text.includes('verify') || text.includes('bestätigen')) {{
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
            await self.cdp.send_cmd("Page.navigate", {"url": "https://accounts.google.com/EmbeddedSetup"})
            await asyncio.sleep(2.5)

            # Fill Email
            self.auth_step = "filling_email"
            fill_email_script = f"""
            (() => {{
                const el = document.querySelector('input[type="email"], #identifierId, input[name="identifier"]');
                if (el) {{
                    el.value = '{email}';
                    el.dispatchEvent(new Event('input', {{ bubbles: true }}));
                    el.dispatchEvent(new Event('change', {{ bubbles: true }}));
                    const nextBtn = document.querySelector('#identifierNext, button, div[role="button"]');
                    if (nextBtn) nextBtn.click();
                    return true;
                }}
                return false;
            }})();
            """
            for _ in range(10):
                res = await self.cdp.send_cmd(
                    "Runtime.evaluate", {"expression": fill_email_script, "returnByValue": True}
                )
                if res and res.get("value"):
                    break
                await asyncio.sleep(0.5)

            await asyncio.sleep(2.5)

            # Fill Password
            self.auth_step = "filling_password"
            fill_pwd_script = f"""
            (() => {{
                const el = document.querySelector('input[type="password"], input[name="Passwd"]');
                if (el) {{
                    el.value = '{password}';
                    el.dispatchEvent(new Event('input', {{ bubbles: true }}));
                    el.dispatchEvent(new Event('change', {{ bubbles: true }}));
                    const nextBtn = document.querySelector('#passwordNext, button, div[role="button"]');
                    if (nextBtn) nextBtn.click();
                    return true;
                }}
                return false;
            }})();
            """
            for _ in range(10):
                res = await self.cdp.send_cmd(
                    "Runtime.evaluate", {"expression": fill_pwd_script, "returnByValue": True}
                )
                if res and res.get("value"):
                    break
                await asyncio.sleep(0.5)

            await asyncio.sleep(3.0)

            # Monitor loop for 2FA or cookie completion (up to 120s)
            deadline = time.monotonic() + 120
            while time.monotonic() < deadline:
                oauth_token = await self._extract_oauth_cookie()
                if oauth_token:
                    self.auth_step = "exchanging"
                    await self._complete_token_exchange(email, oauth_token)
                    return

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

    async def _detect_2fa_challenge(self) -> Optional[Dict[str, Any]]:
        """Scan DOM for Google 2FA challenge markers."""
        check_script = r"""
        (() => {
            const bodyText = document.body ? document.body.innerText : '';

            const numberEl = document.querySelector('div[data-challengeinfo], div[jsname="r4nke"]');
            if (numberEl && numberEl.innerText && numberEl.innerText.trim().length <= 3) {
                return { type: 'prompt', number: numberEl.innerText.trim(), text: bodyText.substring(0, 200) };
            }

            const match = bodyText.match(/(?:tippe|tap|number|zahl)\s*(?:auf|on)?\s*(\d{1,3})/i);
            if (match) {
                return { type: 'prompt', number: match[1], text: bodyText.substring(0, 200) };
            }

            const smsInput = document.querySelector('input[type="tel"], input[name="Pin"], #idvPin');
            if (smsInput && smsInput.offsetParent !== null) {
                return { type: 'sms', title: 'SMS Verification', text: bodyText.substring(0, 200) };
            }

            const totpInput = document.querySelector('#totpPin, input[name="totpPin"]');
            if (totpInput && totpInput.offsetParent !== null) {
                return { type: 'totp', title: 'Authenticator App', text: bodyText.substring(0, 200) };
            }

            if (window.location.href.includes('challenge') || window.location.href.includes('signin/v2')) {
                return { type: 'general', title: 'Google Security Check', text: bodyText.substring(0, 200) };
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
                self.auth_error = f"Google exchange error: {err_code}"
                self.auth_in_progress = False
        except Exception as err:
            _LOGGER.exception("Token exchange failed: %s", err)
            self.auth_step = "error"
            self.auth_error = str(err)
            self.auth_in_progress = False
