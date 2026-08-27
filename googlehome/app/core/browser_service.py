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

        # Log Chromium stderr to a file so we can diagnose startup failures
        log_path = os.path.join(DATA_DIR, "chromium_stderr.log")
        chromium_log = open(log_path, "w")  # noqa: WPS515

        cmd = [
            chromium_bin,
            "--headless",  # Use classic headless (not =new) for Alpine/musl compatibility
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
            "--disable-translate",
            "--metrics-recording-only",
            "--mute-audio",
            "--no-first-run",
            "--safebrowsing-disable-auto-update",
            "--disable-blink-features=AutomationControlled",
            f"--user-agent={USER_AGENT}",
            "about:blank",
        ]

        try:
            _LOGGER.info("Launching headless Chromium via CDP (%s)...", chromium_bin)
            self.proc = subprocess.Popen(cmd, stdout=subprocess.DEVNULL, stderr=chromium_log)
            ready = await self.cdp.wait_for_ready(timeout=20.0)
            if ready:
                _LOGGER.info("Chromium CDP ready on port %d", CDP_PORT)
            else:
                _LOGGER.warning("Chromium CDP was not ready within 20s – check %s", log_path)
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
        _LOGGER.info("Submitting 2FA code...")
        script = f"""
        (() => {{
            const inputs = document.querySelectorAll(
                'input[type="tel"], input[type="text"], input[name="Pin"], #idvPin, #totpPin, '
                + 'input[name="totpPin"], input[autocomplete="one-time-code"]'
            );
            for (const input of inputs) {{
                if (input && input.offsetParent !== null) {{
                    input.focus();
                    const ns = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
                    ns.call(input, '{clean_code}');
                    input.dispatchEvent(new Event('input', {{ bubbles: true }}));
                    input.dispatchEvent(new Event('change', {{ bubbles: true }}));
                    break;
                }}
            }}
            const btns = document.querySelectorAll('button, div[role="button"], input[type="submit"]');
            for (const b of btns) {{
                const text = (b.innerText || b.value || '').toLowerCase();
                if (text.includes('next') || text.includes('weiter') || text.includes('submit')
                    || text.includes('verify') || text.includes('bestätigen') || text.includes('senden')) {{
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
        """Internal async sequence for Google EmbeddedSetup login."""
        try:
            # Enable domains on the initial blank page
            await self.cdp.send_cmd("Network.enable", {})
            await self.cdp.send_cmd("Runtime.enable", {})
            await self.cdp.send_cmd("Page.enable", {})

            self.auth_step = "navigating"
            _LOGGER.info("Navigating to Google EmbeddedSetup...")
            nav_result = await self.cdp.send_cmd(
                "Page.navigate",
                {"url": "https://accounts.google.com/EmbeddedSetup"},
                timeout=30.0,
            )
            _LOGGER.info("Page.navigate result: %s", nav_result)

            # After navigation, reconnect WebSocket to the new page target
            # (Chromium may switch the active page context)
            await asyncio.sleep(2.0)
            reconnected = await self.cdp.reconnect_to_active_page()
            _LOGGER.info("CDP reconnect after navigate: %s", reconnected)

            # Re-enable domains on the new page
            await self.cdp.send_cmd("Network.enable", {})
            await self.cdp.send_cmd("Runtime.enable", {})

            # Wait for page readyState=complete (up to 25s)
            for i in range(50):
                rs = await self.cdp.send_cmd(
                    "Runtime.evaluate",
                    {"expression": "document.readyState", "returnByValue": True},
                    timeout=5.0,
                )
                state = rs.get("value") if rs else None
                _LOGGER.debug("readyState[%d]: %s", i, state)
                if state == "complete":
                    _LOGGER.info("Page readyState=complete after %.1fs", i * 0.5)
                    break
                await asyncio.sleep(0.5)

            # Extra wait for JS/SPA to render
            await asyncio.sleep(3.0)

            url_res = await self.cdp.send_cmd(
                "Runtime.evaluate", {"expression": "window.location.href", "returnByValue": True}
            )
            title_res = await self.cdp.send_cmd(
                "Runtime.evaluate", {"expression": "document.title", "returnByValue": True}
            )
            _LOGGER.info(
                "Loaded URL: %s | Title: %s",
                url_res.get("value") if url_res else "?",
                title_res.get("value") if title_res else "?",
            )

            # Log first 300 chars of body text for diagnosis
            body_res = await self.cdp.send_cmd(
                "Runtime.evaluate",
                {
                    "expression": "document.body ? document.body.innerText.substring(0,300) : 'NO_BODY'",
                    "returnByValue": True,
                },
            )
            _LOGGER.info("Page body preview: %s", body_res.get("value") if body_res else "none")

            _debug_inputs = r"""
            (() => {
                const inputs = Array.from(document.querySelectorAll('input')).map(i => ({
                    type: i.type, name: i.name, id: i.id,
                    visible: i.offsetParent !== null, placeholder: i.placeholder
                }));
                return JSON.stringify(inputs.slice(0, 15));
            })();
            """
            dbg = await self.cdp.send_cmd("Runtime.evaluate", {"expression": _debug_inputs, "returnByValue": True})
            _LOGGER.info("Input fields on page: %s", dbg.get("value") if dbg else "none")

            # ── STEP 1: Fill Email ────────────────────────────────────────────
            self.auth_step = "filling_email"
            _LOGGER.info("Filling email: %s", email)
            safe_email = email.replace("'", "\\'").replace("\\", "\\\\")
            fill_email_script = f"""
            (() => {{
                const selectors = [
                    'input[type="email"]', '#identifierId',
                    'input[name="identifier"]', 'input[name="email"]',
                    'input[autocomplete="username"]', 'input[autocomplete="email"]',
                ];
                for (const sel of selectors) {{
                    const el = document.querySelector(sel);
                    if (el && el.offsetParent !== null) {{
                        el.focus();
                        const ns = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
                        ns.call(el, '{safe_email}');
                        el.dispatchEvent(new Event('input', {{ bubbles: true }}));
                        el.dispatchEvent(new Event('change', {{ bubbles: true }}));
                        return 'found:' + sel;
                    }}
                }}
                return null;
            }})();
            """
            filled_email = False
            for attempt in range(30):
                res = await self.cdp.send_cmd(
                    "Runtime.evaluate", {"expression": fill_email_script, "returnByValue": True}
                )
                val = res.get("value") if res else None
                if val and isinstance(val, str) and val.startswith("found:"):
                    _LOGGER.info("Email input found: %s", val)
                    filled_email = True
                    break
                if attempt == 14:
                    url2 = await self.cdp.send_cmd(
                        "Runtime.evaluate", {"expression": "window.location.href", "returnByValue": True}
                    )
                    _LOGGER.warning("No email input after 7s. URL: %s", url2.get("value") if url2 else "?")
                    dbg2 = await self.cdp.send_cmd(
                        "Runtime.evaluate", {"expression": _debug_inputs, "returnByValue": True}
                    )
                    _LOGGER.warning("Inputs at 7s: %s", dbg2.get("value") if dbg2 else "none")
                await asyncio.sleep(0.5)

            if not filled_email:
                title_res = await self.cdp.send_cmd(
                    "Runtime.evaluate", {"expression": "document.title", "returnByValue": True}
                )
                self.auth_step = "error"
                self.auth_error = (
                    f"Could not find Google email input. "
                    f"Page title: '{title_res.get('value') if title_res else 'unknown'}'. "
                    "Google may be blocking headless browsers."
                )
                self.auth_in_progress = False
                _LOGGER.error(self.auth_error)
                return

            # Click "Weiter/Next" after email
            click_next_email = r"""
            (() => {
                for (const sel of ['#identifierNext button', '#identifierNext',
                                   'button[jsname="LgbsSe"]', 'button[type="button"]',
                                   'button[type="submit"]']) {
                    const btn = document.querySelector(sel);
                    if (btn && btn.offsetParent !== null) { btn.click(); return 'clicked:' + sel; }
                }
                const form = document.querySelector('form');
                if (form) { form.submit(); return 'form_submit'; }
                return null;
            })();
            """
            click_res = await self.cdp.send_cmd(
                "Runtime.evaluate", {"expression": click_next_email, "returnByValue": True}
            )
            _LOGGER.info("Email Next click: %s", click_res.get("value") if click_res else "none")
            await asyncio.sleep(3.5)

            email_err = await self._check_page_error()
            if email_err:
                self.auth_step = "error"
                self.auth_error = f"Google rejected email: {email_err}"
                self.auth_in_progress = False
                _LOGGER.error(self.auth_error)
                return

            # ── STEP 2: Fill Password ─────────────────────────────────────────
            self.auth_step = "filling_password"
            _LOGGER.info("Filling password...")
            safe_password = password.replace("'", "\\'").replace("\\", "\\\\")
            fill_pwd_script = f"""
            (() => {{
                for (const sel of ['input[type="password"]', 'input[name="Passwd"]',
                                   'input[name="password"]', 'input[autocomplete="current-password"]']) {{
                    const el = document.querySelector(sel);
                    if (el && el.offsetParent !== null) {{
                        el.focus();
                        const ns = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
                        ns.call(el, '{safe_password}');
                        el.dispatchEvent(new Event('input', {{ bubbles: true }}));
                        el.dispatchEvent(new Event('change', {{ bubbles: true }}));
                        return 'found:' + sel;
                    }}
                }}
                return null;
            }})();
            """
            filled_pwd = False
            for attempt in range(24):
                res = await self.cdp.send_cmd(
                    "Runtime.evaluate", {"expression": fill_pwd_script, "returnByValue": True}
                )
                val = res.get("value") if res else None
                if val and isinstance(val, str) and val.startswith("found:"):
                    _LOGGER.info("Password input found: %s", val)
                    filled_pwd = True
                    break
                if attempt == 9:
                    url3 = await self.cdp.send_cmd(
                        "Runtime.evaluate", {"expression": "window.location.href", "returnByValue": True}
                    )
                    _LOGGER.warning("No password input after 5s. URL: %s", url3.get("value") if url3 else "?")
                await asyncio.sleep(0.5)

            if not filled_pwd:
                title_res = await self.cdp.send_cmd(
                    "Runtime.evaluate", {"expression": "document.title", "returnByValue": True}
                )
                self.auth_step = "error"
                self.auth_error = (
                    f"Could not find Google password input. "
                    f"Page title: '{title_res.get('value') if title_res else 'unknown'}'. "
                    "Google may have rejected the email or is showing a different challenge."
                )
                self.auth_in_progress = False
                _LOGGER.error(self.auth_error)
                return

            # Click "Weiter/Next" after password
            click_next_pwd = r"""
            (() => {
                for (const sel of ['#passwordNext button', '#passwordNext',
                                   'button[jsname="LgbsSe"]', 'button[type="button"]',
                                   'button[type="submit"]']) {
                    const btn = document.querySelector(sel);
                    if (btn && btn.offsetParent !== null) { btn.click(); return 'clicked:' + sel; }
                }
                const form = document.querySelector('form');
                if (form) { form.submit(); return 'form_submit'; }
                return null;
            })();
            """
            pwd_click = await self.cdp.send_cmd(
                "Runtime.evaluate", {"expression": click_next_pwd, "returnByValue": True}
            )
            _LOGGER.info("Password Next click: %s", pwd_click.get("value") if pwd_click else "none")
            await asyncio.sleep(4.0)

            pwd_err = await self._check_page_error()
            if pwd_err:
                self.auth_step = "error"
                self.auth_error = f"Google rejected password: {pwd_err}"
                self.auth_in_progress = False
                _LOGGER.error(self.auth_error)
                return

            # ── STEP 3+: Monitor loop ─────────────────────────────────────────
            # Handles intermediate screens (who-uses-device, privacy/terms), 2FA, and final cookie.
            deadline = time.monotonic() + 180
            _handled_intermediate = False
            _handled_terms = False

            while time.monotonic() < deadline:
                url_now = await self.cdp.send_cmd(
                    "Runtime.evaluate", {"expression": "window.location.href", "returnByValue": True}
                )
                current_url = url_now.get("value") if url_now else ""
                _LOGGER.debug("Monitor loop URL: %s", current_url)

                # Check for oauth_token cookie = success
                oauth_token = await self._extract_oauth_cookie()
                if oauth_token:
                    self.auth_step = "exchanging"
                    _LOGGER.info("oauth_token cookie found – exchanging for Master Token...")
                    await self._complete_token_exchange(email, oauth_token)
                    return

                # "Wer nutzt dieses Gerät?" – "Ich" is pre-selected; just click Weiter/Next.
                # Also handles any other intermediate confirmation screen.
                if not _handled_intermediate:
                    next_result = await self._click_continue_next()
                    if next_result:
                        _LOGGER.info("Clicked Weiter/Next on intermediate screen: %s", next_result)
                        _handled_intermediate = True
                        await asyncio.sleep(2.5)
                        continue

                # Datenschutz/Terms – click Accept/Zustimmen
                if not _handled_terms:
                    terms_result = await self._click_accept_terms()
                    if terms_result:
                        _LOGGER.info("Clicked Accept/Zustimmen on terms screen: %s", terms_result)
                        _handled_terms = True
                        await asyncio.sleep(2.5)
                        continue

                # Check for hard errors (not on 2FA pages)
                page_err = await self._check_page_error()
                if page_err:
                    err_lower = page_err.lower()
                    is_2fa_url = any(k in current_url for k in ["challenge", "totp", "smsauth", "pincodecheck"])
                    benign = any(k in err_lower for k in ["verify", "challenge", "2-step", "2fa", "bestätigen", "code"])
                    if not is_2fa_url and not benign:
                        self.auth_step = "error"
                        self.auth_error = f"Google error: {page_err}"
                        self.auth_in_progress = False
                        _LOGGER.error(self.auth_error)
                        return

                # Detect 2FA challenge
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
            self.auth_error = "Authentication timed out after 3 minutes"
            self.auth_in_progress = False
        except asyncio.CancelledError:
            self.auth_in_progress = False
            self.auth_step = "idle"
        except Exception as err:
            _LOGGER.exception("Error in Google Auth Sequence: %s", err)
            self.auth_step = "error"
            self.auth_error = str(err)
            self.auth_in_progress = False

    async def _click_continue_next(self) -> Optional[str]:
        """Click 'Weiter / Next / Continue' on screens where the selection is already pre-filled.

        Used for the 'Who uses this device?' screen where 'Ich/Me' is pre-selected.
        Does NOT click Cancel/Zurück/Ablehnen.
        """
        script = r"""
        (() => {
            const avoid = ['cancel', 'ablehnen', 'disagree', 'deny', 'back', 'zurück', 'nein', 'no'];
            const accept = ['weiter', 'next', 'continue', 'fortfahren', 'bestätigen', 'confirm'];
            const candidates = document.querySelectorAll(
                'button, div[role="button"], a[role="button"]'
            );
            for (const el of candidates) {
                const text = (el.innerText || el.textContent || '').toLowerCase().trim();
                if (!text || text.length > 60) continue;
                if (avoid.some(kw => text.includes(kw))) continue;
                if (accept.some(kw => text.includes(kw)) && el.offsetParent !== null) {
                    el.click();
                    return text.substring(0, 30);
                }
            }
            return null;
        })();
        """
        res = await self.cdp.send_cmd("Runtime.evaluate", {"expression": script, "returnByValue": True})
        val = res.get("value") if res else None
        return val if val and isinstance(val, str) else None

    async def _click_accept_terms(self) -> Optional[str]:
        """Click 'Accept / Agree / Zustimmen' on privacy/terms screens."""
        script = r"""
        (() => {
            const avoid = ['cancel', 'ablehnen', 'disagree', 'deny', 'back', 'zurück', 'nein', 'no'];
            const accept = ['accept', 'agree', 'zustimmen', 'ich stimme zu', 'i agree',
                            'akzeptieren', 'got it', 'verstanden'];
            const candidates = document.querySelectorAll(
                'button, div[role="button"], a[role="button"]'
            );
            for (const el of candidates) {
                const text = (el.innerText || el.textContent || '').toLowerCase().trim();
                if (!text || text.length > 80) continue;
                if (avoid.some(kw => text.includes(kw))) continue;
                if (accept.some(kw => text.includes(kw)) && el.offsetParent !== null) {
                    el.click();
                    return text.substring(0, 30);
                }
            }
            return null;
        })();
        """
        res = await self.cdp.send_cmd("Runtime.evaluate", {"expression": script, "returnByValue": True})
        val = res.get("value") if res else None
        return val if val and isinstance(val, str) else None

    async def _check_page_error(self) -> Optional[str]:
        """Check for Google error elements in DOM."""
        script = r"""
        (() => {
            const err = document.querySelector(
                'div[aria-live="assertive"], div[jsname="B1fBne"], span[jsslot]'
            );
            if (err && err.innerText && err.innerText.trim().length > 3) {
                return err.innerText.trim();
            }
            return null;
        })();
        """
        res = await self.cdp.send_cmd("Runtime.evaluate", {"expression": script, "returnByValue": True})
        if res and isinstance(res.get("value"), str):
            val = res["value"].strip()
            if len(val) > 3:
                return val
        return None

    async def _detect_2fa_challenge(self) -> Optional[Dict[str, Any]]:
        """Scan DOM for Google 2FA challenge markers."""
        script = r"""
        (() => {
            const bodyText = document.body ? document.body.innerText : '';

            // 1. Phone Prompt (Number tap)
            const numberEl = document.querySelector(
                'div[data-challengeinfo], div[jsname="r4nke"], span[jsname="V67aGc"], div.hK3Xcf'
            );
            if (numberEl && numberEl.innerText && /^\d{1,3}$/.test(numberEl.innerText.trim())) {
                return { type: 'prompt', number: numberEl.innerText.trim(), text: bodyText.substring(0, 300) };
            }
            const match = bodyText.match(/(?:tippe|tap|number|zahl|select)\s*(?:auf|on)?\s*[:\s]*(\d{1,3})/i);
            if (match) {
                return { type: 'prompt', number: match[1], text: bodyText.substring(0, 300) };
            }

            // 2. SMS / Phone code
            const smsInput = document.querySelector(
                'input[type="tel"], input[name="Pin"], #idvPin, #idvanyphonecollectNext input'
            );
            if (smsInput && smsInput.offsetParent !== null) {
                return { type: 'sms', title: 'SMS Verification', text: bodyText.substring(0, 300) };
            }

            // 3. Authenticator App (TOTP)
            const totpInput = document.querySelector(
                '#totpPin, input[name="totpPin"], input[autocomplete="one-time-code"]'
            );
            if (totpInput && totpInput.offsetParent !== null) {
                return { type: 'totp', title: 'Authenticator App', text: bodyText.substring(0, 300) };
            }

            // 4. General challenge URL
            if (window.location.href.includes('challenge') || window.location.href.includes('signin/v2')) {
                return { type: 'general', title: 'Google Security Verification', text: bodyText.substring(0, 300) };
            }

            return null;
        })();
        """
        res = await self.cdp.send_cmd("Runtime.evaluate", {"expression": script, "returnByValue": True})
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
            from gpsoauth import exchange_token  # type: ignore[import-untyped]

            res = exchange_token(email, oauth_token, "android-701ab861a7be")
            if "Token" in res:
                master_token = res["Token"]
                if self._on_success_callback:
                    self._on_success_callback(email, master_token)
                self.auth_step = "success"
                self.auth_in_progress = False
                _LOGGER.info("Master Token successfully generated for %s", email)
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
