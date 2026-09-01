import asyncio
import logging
from typing import Any, Dict, Optional

from .cdp import CDPClient

_LOGGER = logging.getLogger(__name__)


class AuthHelper:
    """Automates login form submission and 2FA via headless browser and API."""

    def __init__(self, cdp: CDPClient) -> None:
        self.cdp = cdp

    async def get_waf_token(self) -> Optional[str]:
        """Extract AWS WAF token from browser cookies if solved."""
        res = await self.cdp.send_cmd(
            "Network.getCookies",
            {"urls": ["https://app.traderepublic.com", "https://traderepublic.com", "https://api.traderepublic.com"]},
        )
        if res and "cookies" in res:
            for cookie in res["cookies"]:
                if "aws-waf" in cookie.get("name", "").lower():
                    return cookie.get("value")
        return None

    async def inject_session_cookies(self, token: str) -> None:
        """Inject saved session token into Chromium cookies and localStorage to persist authenticated state."""
        import time

        if not token:
            return
        clean_tok = token.strip().strip('"').strip("'")

        # Set cookie lifetime to 1 year so browser profile persists and never evicts it
        expires_timestamp = int(time.time()) + (365 * 24 * 60 * 60)

        try:
            # 1. Set CDP Network Cookies
            for domain in [".traderepublic.com", "app.traderepublic.com", "api.traderepublic.com"]:
                for name in ["tr_session", "sessionToken", "tr_session_id", "auth_token"]:
                    await self.cdp.send_cmd(
                        "Network.setCookie",
                        {
                            "name": name,
                            "value": clean_tok,
                            "domain": domain,
                            "path": "/",
                            "secure": True,
                            "httpOnly": False,
                            "sameSite": "None",
                            "expires": expires_timestamp,
                        },
                    )

            # 2. Set localStorage in browser context
            set_storage_script = f"""
            (() => {{
                try {{
                    localStorage.setItem('sessionToken', JSON.stringify('{clean_tok}'));
                    localStorage.setItem('tr_session', '{clean_tok}');
                    localStorage.setItem('auth_token', '{clean_tok}');
                    sessionStorage.setItem('sessionToken', '{clean_tok}');
                    sessionStorage.setItem('tr_session', '{clean_tok}');
                    document.cookie = 'tr_session={clean_tok}; path=/; domain=.traderepublic.com; secure; SameSite=None; max-age=31536000';
                    document.cookie = 'sessionToken={clean_tok}; path=/; domain=.traderepublic.com; secure; SameSite=None; max-age=31536000';
                }} catch(e) {{}}
            }})()
            """
            await self.cdp.send_cmd("Runtime.evaluate", {"expression": set_storage_script})
            _LOGGER.debug("Injected session token into Chromium cookies and storage")
        except Exception as e:
            _LOGGER.debug("Failed to inject cookies into Chromium: %s", e)

    async def extract_token_from_cookies(self) -> Optional[str]:
        """Extract valid JWT session token from Chromium via CDP cookies and storage."""
        # 1. Check CDP Network Cookies
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
            ("Network.getAllCookies", {}),
        ]:
            try:
                res = await self.cdp.send_cmd(cdp_method, params)
                if res and "cookies" in res:
                    # Pass 1: explicit JWT tokens
                    for cookie in res["cookies"]:
                        val = str(cookie.get("value", "")).strip().strip('"').strip("'")
                        if val.startswith("eyJ") and len(val) > 40:
                            return val
                    # Pass 2: known TR session names
                    for cookie in res["cookies"]:
                        cname = cookie.get("name", "").lower()
                        val = str(cookie.get("value", "")).strip().strip('"').strip("'")
                        if (
                            any(
                                k in cname
                                for k in ("tr_session", "sessiontoken", "session_token", "auth_token", "tr_refresh")
                            )
                            and len(val) > 15
                        ):
                            return val
            except Exception:  # noqa: BLE001
                pass

        # 2. Check localStorage & sessionStorage (all keys)
        storage_script = """
        (() => {
            try {
                for (let i = 0; i < localStorage.length; i++) {
                    const k = localStorage.key(i);
                    const v = localStorage.getItem(k);
                    if (v && typeof v === 'string') {
                        if (v.startsWith('eyJ') && v.length > 40) return v;
                        try {
                            const parsed = JSON.parse(v);
                            if (typeof parsed === 'string' && parsed.startsWith('eyJ')) return parsed;
                            if (parsed && typeof parsed === 'object') {
                                for (let prop of ['sessionToken', 'token', 'refreshToken', 'accessToken', 'tr_session', 'jwt']) {
                                    if (parsed[prop] && typeof parsed[prop] === 'string' && (parsed[prop].startsWith('eyJ') || parsed[prop].length > 20)) {
                                        return parsed[prop];
                                    }
                                }
                            }
                        } catch(e) {}
                    }
                }
                for (let i = 0; i < sessionStorage.length; i++) {
                    const k = sessionStorage.key(i);
                    const v = sessionStorage.getItem(k);
                    if (v && typeof v === 'string') {
                        if (v.startsWith('eyJ') && v.length > 40) return v;
                    }
                }
            } catch(e) {}
            return null;
        })()
        """
        storage_res = await self.cdp.send_cmd("Runtime.evaluate", {"expression": storage_script, "returnByValue": True})
        if storage_res and isinstance(storage_res, dict):
            val = storage_res.get("result", {}).get("value")
            if val and isinstance(val, str) and (val.startswith("eyJ") or len(val) > 20):
                return val.strip().strip('"').strip("'")

        # 3. Check document.cookie via Runtime evaluation
        eval_script = """
        (() => {
            const cookies = document.cookie.split(';');
            for (let c of cookies) {
                const parts = c.trim().split('=');
                if (parts.length >= 2) {
                    const name = parts[0].toLowerCase();
                    const val = parts.slice(1).join('=').trim().replace(/^["']|["']$/g, '');
                    if (val.startsWith('eyJ') || ((name.includes('session') || name.includes('token') || name.includes('tr_')) && val.length > 20)) {
                        return val;
                    }
                }
            }
            return null;
        })()
        """
        eval_res = await self.cdp.send_cmd("Runtime.evaluate", {"expression": eval_script, "returnByValue": True})
        if eval_res and isinstance(eval_res, dict):
            val = eval_res.get("result", {}).get("value")
            if val and isinstance(val, str) and (val.startswith("eyJ") or len(val) > 20):
                return val.strip().strip('"').strip("'")

        return None

    async def execute_login(self, clean_phone: str, clean_pin: str) -> Dict[str, Any]:
        """Navigate to login, enter credentials, solve challenge and trigger push/SMS."""
        await self.cdp.send_cmd("Page.navigate", {"url": "https://app.traderepublic.com/login"})
        await asyncio.sleep(4)

        # Cookie banner
        banner_script = """
        (() => {
            const btns = Array.from(document.querySelectorAll('button'));
            const acceptBtn = btns.find(b => b.textContent && (b.textContent.includes('Accept') || b.textContent.includes('Akzeptieren') || b.textContent.includes('Allow')));
            if (acceptBtn) { acceptBtn.click(); return true; }
            return false;
        })()
        """
        await self.cdp.send_cmd("Runtime.evaluate", {"expression": banner_script})
        await asyncio.sleep(1)

        # Phone Number Input & Submit
        phone_script = f"""
        (() => {{
            const input = document.querySelector('input[name="phoneNumber"], input[type="tel"], input[autocomplete="tel"], input[placeholder*="Phone"], input[placeholder*="Telefon"], input');
            if (!input) return {{ ok: false, stage: 'phone', reason: 'input_not_found' }};
            input.focus();
            input.click();
            const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
            nativeSetter.call(input, "{clean_phone}");
            input.dispatchEvent(new Event('input', {{ bubbles: true, composed: true }}));
            input.dispatchEvent(new Event('change', {{ bubbles: true, composed: true }}));
            input.dispatchEvent(new KeyboardEvent('keydown', {{ bubbles: true, composed: true, key: 'Enter', code: 'Enter', keyCode: 13, which: 13 }}));
            input.dispatchEvent(new KeyboardEvent('keypress', {{ bubbles: true, composed: true, key: 'Enter', code: 'Enter', keyCode: 13, which: 13 }}));
            input.dispatchEvent(new KeyboardEvent('keyup', {{ bubbles: true, composed: true, key: 'Enter', code: 'Enter', keyCode: 13, which: 13 }}));

            // Method 1: Find and click visible submit/next button
            const btns = Array.from(document.querySelectorAll('button, div[role="button"], a[role="button"]'));
            const btn = btns.find(b => {{
                const text = (b.textContent || '').trim().toLowerCase();
                const testId = (b.getAttribute('data-testid') || '').toLowerCase();
                const type = (b.getAttribute('type') || '').toLowerCase();
                return type === 'submit' || testId.includes('submit') || testId.includes('next') || testId.includes('login') ||
                       ['weiter', 'next', 'continue', 'anmelden', 'login', 'senden', 'submit'].some(k => text === k || text.includes(k));
            }});

            if (btn) {{
                btn.removeAttribute('disabled');
                btn.disabled = false;
                btn.focus();
                const rect = btn.getBoundingClientRect();
                const clientX = rect.left + rect.width / 2;
                const clientY = rect.top + rect.height / 2;
                const mouseOpts = {{ bubbles: true, cancelable: true, view: window, clientX, clientY }};
                btn.dispatchEvent(new MouseEvent('pointerdown', mouseOpts));
                btn.dispatchEvent(new MouseEvent('mousedown', mouseOpts));
                btn.dispatchEvent(new MouseEvent('pointerup', mouseOpts));
                btn.dispatchEvent(new MouseEvent('mouseup', mouseOpts));
                btn.dispatchEvent(new MouseEvent('click', mouseOpts));
                btn.click();
                return {{ ok: true, stage: 'phone', clicked: true, btnText: (btn.textContent || '').trim() }};
            }}

            if (input.form) {{
                try {{
                    input.form.requestSubmit();
                    return {{ ok: true, stage: 'phone', method: 'form_requestSubmit' }};
                }} catch(e) {{}}
            }}

            return {{ ok: true, stage: 'phone', clicked: false }};
        }})()
        """
        phone_res = await self.cdp.send_cmd("Runtime.evaluate", {"expression": phone_script, "returnByValue": True})
        _LOGGER.info("CDP Phone step result: %s", phone_res)
        await asyncio.sleep(3.0)

        # PIN Input & Submit
        pin_script = f"""
        (() => {{
            const input = document.querySelector('input[type="password"], input[name="pin"], input[name="password"], input[inputmode="numeric"], input[autocomplete="current-password"]');
            if (!input) return {{ ok: false, stage: 'pin', reason: 'input_not_found' }};
            input.focus();
            input.click();
            const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
            nativeSetter.call(input, "{clean_pin}");
            input.dispatchEvent(new Event('input', {{ bubbles: true, composed: true }}));
            input.dispatchEvent(new Event('change', {{ bubbles: true, composed: true }}));
            input.dispatchEvent(new KeyboardEvent('keydown', {{ bubbles: true, composed: true, key: 'Enter', code: 'Enter', keyCode: 13, which: 13 }}));
            input.dispatchEvent(new KeyboardEvent('keypress', {{ bubbles: true, composed: true, key: 'Enter', code: 'Enter', keyCode: 13, which: 13 }}));
            input.dispatchEvent(new KeyboardEvent('keyup', {{ bubbles: true, composed: true, key: 'Enter', code: 'Enter', keyCode: 13, which: 13 }}));

            // Method 1: Find and click visible submit/login button
            const btns = Array.from(document.querySelectorAll('button, div[role="button"], a[role="button"]'));
            const btn = btns.find(b => {{
                const text = (b.textContent || '').trim().toLowerCase();
                const testId = (b.getAttribute('data-testid') || '').toLowerCase();
                const type = (b.getAttribute('type') || '').toLowerCase();
                return type === 'submit' || testId.includes('submit') || testId.includes('login') || testId.includes('pin') ||
                       ['anmelden', 'login', 'weiter', 'next', 'submit', 'bestätigen', 'confirm'].some(k => text === k || text.includes(k));
            }});

            if (btn) {{
                btn.removeAttribute('disabled');
                btn.disabled = false;
                btn.focus();
                const rect = btn.getBoundingClientRect();
                const clientX = rect.left + rect.width / 2;
                const clientY = rect.top + rect.height / 2;
                const mouseOpts = {{ bubbles: true, cancelable: true, view: window, clientX, clientY }};
                btn.dispatchEvent(new MouseEvent('pointerdown', mouseOpts));
                btn.dispatchEvent(new MouseEvent('mousedown', mouseOpts));
                btn.dispatchEvent(new MouseEvent('pointerup', mouseOpts));
                btn.dispatchEvent(new MouseEvent('mouseup', mouseOpts));
                btn.dispatchEvent(new MouseEvent('click', mouseOpts));
                btn.click();
                return {{ ok: true, stage: 'pin', clicked: true, btnText: (btn.textContent || '').trim() }};
            }}

            if (input.form) {{
                try {{
                    input.form.requestSubmit();
                    return {{ ok: true, stage: 'pin', method: 'form_requestSubmit' }};
                }} catch(e) {{}}
            }}

            return {{ ok: true, stage: 'pin', clicked: false }};
        }})()
        """
        pin_res = await self.cdp.send_cmd("Runtime.evaluate", {"expression": pin_script, "returnByValue": True})
        _LOGGER.info("CDP PIN step result: %s", pin_res)

        # Wait for TR's React app to fire its login API call, then capture the response.
        # This reveals whether AWS WAF is blocking the request or TR accepted/rejected it.
        await asyncio.sleep(4.0)

        network_spy_script = """
        (() => {
            // Collect all performance resource entries for TR API calls made after submit
            const entries = performance.getEntriesByType('resource').filter(e =>
                e.name.includes('api.traderepublic.com') || e.name.includes('auth') || e.name.includes('login')
            );
            return JSON.stringify(entries.map(e => ({
                url: e.name,
                duration: Math.round(e.duration),
                transferSize: e.transferSize
            })).slice(-10));
        })()
        """
        spy_res = await self.cdp.send_cmd("Runtime.evaluate", {"expression": network_spy_script, "returnByValue": True})
        network_calls = spy_res and spy_res.get("result", {}).get("value")
        if network_calls:
            _LOGGER.info("TR network calls after submit: %s", network_calls)
        else:
            _LOGGER.warning(
                "No TR network calls detected after form submit — WAF may have blocked the request or React did not fire"
            )

        # Check current page URL (TR redirects away from /login on success)
        url_res = await self.cdp.send_cmd(
            "Runtime.evaluate", {"expression": "window.location.href", "returnByValue": True}
        )
        current_url = url_res and url_res.get("result", {}).get("value", "unknown")
        _LOGGER.info("Page URL after PIN submit: %s", current_url)

        dom_error_script = """
        (() => {
            const errEl = document.querySelector('[role="alert"], [data-testid="error-message"], .error, .alert');
            if (errEl && errEl.textContent) return errEl.textContent.trim();
            return null;
        })()
        """
        dom_err = await self.cdp.send_cmd("Runtime.evaluate", {"expression": dom_error_script, "returnByValue": True})
        dom_err_text = dom_err and dom_err.get("result", {}).get("value")
        if dom_err_text:
            _LOGGER.warning("CDP DOM error detected: %s", dom_err_text)

        return {
            "success": True,
            "message": dom_err_text or "Credentials submitted. Please confirm in your Trade Republic smartphone app.",
        }

    async def submit_2fa_code(self, clean_code: str) -> None:
        """Submit 2FA verification code to form."""
        if clean_code:
            code_script = f"""
            (() => {{
                // Try single input (e.g. name="code" or inputmode="numeric")
                const singleOtp = document.querySelector('input[name="code"], input[type="number"], input[autocomplete="one-time-code"], input[data-testid="otp-input"], input[type="tel"]');
                if (singleOtp) {{
                    singleOtp.focus();
                    const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
                    nativeSetter.call(singleOtp, "{clean_code}");
                    singleOtp.dispatchEvent(new Event('input', {{ bubbles: true, composed: true }}));
                    singleOtp.dispatchEvent(new Event('change', {{ bubbles: true, composed: true }}));
                }}

                // Try multi-box OTP input (e.g. 4 separate single-character inputs)
                const multiInputs = Array.from(document.querySelectorAll('input[maxlength="1"], input[data-index]'));
                if (multiInputs.length >= 4) {{
                    for (let i = 0; i < 4; i++) {{
                        const char = "{clean_code}"[i] || '';
                        const inp = multiInputs[i];
                        if (inp && char) {{
                            inp.focus();
                            const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
                            nativeSetter.call(inp, char);
                            inp.dispatchEvent(new Event('input', {{ bubbles: true, composed: true }}));
                            inp.dispatchEvent(new Event('change', {{ bubbles: true, composed: true }}));
                        }}
                    }}
                }}

                const btn = Array.from(document.querySelectorAll('button')).find(b => b.type === 'submit' || b.getAttribute('data-testid') === 'login-submit-button' || (b.textContent && (b.textContent.includes('Weiter') || b.textContent.includes('Confirm') || b.textContent.includes('Bestätigen') || b.textContent.includes('Next'))));
                if (btn) {{
                    btn.disabled = false;
                    btn.click();
                }}
                return true;
            }})()
            """
            await self.cdp.send_cmd("Runtime.evaluate", {"expression": code_script})
