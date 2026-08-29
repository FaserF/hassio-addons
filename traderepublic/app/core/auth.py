import asyncio
import json
import logging
from typing import Any, Dict, Optional

import aiohttp

from .cdp import CDPClient
from .constants import USER_AGENT

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
        ]:
            res = await self.cdp.send_cmd(cdp_method, params)
            if res and "cookies" in res:
                for cookie in res["cookies"]:
                    cname = cookie.get("name", "").lower()
                    val = cookie.get("value", "")
                    if val and (val.startswith("eyJ") or len(val) > 40):
                        if any(k in cname for k in ("session", "token", "auth", "tr_")):
                            return val.strip().strip('"').strip("'")
                for cookie in res["cookies"]:
                    cname = cookie.get("name", "").lower()
                    if cname in ("tr_session", "sessiontoken", "tr_session_id", "auth_token", "tr_refresh"):
                        token = cookie.get("value")
                        if token and len(token) > 20:
                            return token.strip().strip('"').strip("'")

        # 2. Check localStorage & sessionStorage
        storage_script = """
        (() => {
            try {
                for (let i = 0; i < localStorage.length; i++) {
                    const k = localStorage.key(i);
                    const v = localStorage.getItem(k);
                    if (v && typeof v === 'string') {
                        if (k === 'sessionToken' || k === 'tr_session' || k.includes('session') || k.includes('auth') || k.includes('token')) {
                            try {
                                const parsed = JSON.parse(v);
                                if (typeof parsed === 'string' && (parsed.startsWith('eyJ') || parsed.length > 30)) return parsed;
                                if (parsed && typeof parsed === 'object') {
                                    if (parsed.sessionToken) return parsed.sessionToken;
                                    if (parsed.token) return parsed.token;
                                    if (parsed.refreshToken) return parsed.refreshToken;
                                }
                            } catch(e) {}
                            if (v.startsWith('eyJ') || v.length > 30) return v;
                        }
                    }
                }
                for (let i = 0; i < sessionStorage.length; i++) {
                    const k = sessionStorage.key(i);
                    const v = sessionStorage.getItem(k);
                    if (v && typeof v === 'string' && (v.startsWith('eyJ') || v.length > 30)) return v;
                }
            } catch(e) {}
            return null;
        })()
        """
        storage_res = await self.cdp.send_cmd("Runtime.evaluate", {"expression": storage_script, "returnByValue": True})
        if storage_res and isinstance(storage_res, dict):
            val = storage_res.get("result", {}).get("value")
            if val and isinstance(val, str) and (val.startswith("eyJ") or len(val) > 30):
                return val.strip().strip('"').strip("'")

        # 3. Check document.cookie via Runtime evaluation
        eval_script = """
        (() => {
            const cookies = document.cookie.split(';');
            for (let c of cookies) {
                const parts = c.trim().split('=');
                if (parts.length >= 2) {
                    const name = parts[0].toLowerCase();
                    const val = parts.slice(1).join('=');
                    if (val.startsWith('eyJ') || ((name.includes('session') || name.includes('token') || name.includes('tr_')) && val.length > 30)) {
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
            if val and isinstance(val, str) and (val.startswith("eyJ") or len(val) > 30):
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

        # Phone Number
        phone_script = f"""
        (() => {{
            const input = document.querySelector('input[name="phoneNumber"], input[type="tel"], input[autocomplete="tel"], input');
            if (input) {{
                input.focus();
                const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
                nativeSetter.call(input, "{clean_phone}");
                input.dispatchEvent(new Event('input', {{ bubbles: true, composed: true }}));
                input.dispatchEvent(new Event('change', {{ bubbles: true, composed: true }}));
                input.dispatchEvent(new KeyboardEvent('keydown', {{ key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }}));
                input.dispatchEvent(new KeyboardEvent('keyup', {{ key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }}));
                const btn = Array.from(document.querySelectorAll('button')).find(b => b.type === 'submit' || b.getAttribute('data-testid') === 'login-submit-button' || (b.textContent && (b.textContent.includes('Weiter') || b.textContent.includes('Next') || b.textContent.includes('Continue') || b.textContent.includes('Anmelden'))));
                if (btn) {{
                    btn.disabled = false;
                    btn.click();
                }}
                return true;
            }}
            return false;
        }})()
        """
        await self.cdp.send_cmd("Runtime.evaluate", {"expression": phone_script})
        await asyncio.sleep(2.5)

        # PIN
        pin_script = f"""
        (() => {{
            const input = document.querySelector('input[type="password"], input[name="pin"], input[name="password"]');
            if (input) {{
                input.focus();
                const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
                nativeSetter.call(input, "{clean_pin}");
                input.dispatchEvent(new Event('input', {{ bubbles: true, composed: true }}));
                input.dispatchEvent(new Event('change', {{ bubbles: true, composed: true }}));
                input.dispatchEvent(new KeyboardEvent('keydown', {{ key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }}));
                input.dispatchEvent(new KeyboardEvent('keyup', {{ key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }}));
                const btn = Array.from(document.querySelectorAll('button')).find(b => b.type === 'submit' || b.getAttribute('data-testid') === 'login-submit-button' || (b.textContent && (b.textContent.includes('Anmelden') || b.textContent.includes('Login') || b.textContent.includes('Weiter') || b.textContent.includes('Next') || b.textContent.includes('Submit'))));
                if (btn) {{
                    btn.disabled = false;
                    btn.click();
                }}
                if (input.form) {{
                    input.form.dispatchEvent(new Event('submit', {{ bubbles: true, cancelable: true }}));
                }}
                return true;
            }}
            return false;
        }})()
        """
        await self.cdp.send_cmd("Runtime.evaluate", {"expression": pin_script, "returnByValue": True})

        dom_error_script = """
        (() => {
            const errEl = document.querySelector('[role="alert"], [data-testid="error-message"], .error, .alert');
            if (errEl && errEl.textContent) return errEl.textContent.trim();
            return null;
        })()
        """
        dom_err = await self.cdp.send_cmd("Runtime.evaluate", {"expression": dom_error_script, "returnByValue": True})
        dom_err_text = dom_err and dom_err.get("result", {}).get("value")

        return {
            "success": True,
            "message": dom_err_text or "Credentials submitted. Please confirm in your Trade Republic smartphone app.",
        }

    async def submit_2fa_code(self, clean_code: str) -> None:
        """Submit 2FA verification code to form."""
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
            await self.cdp.send_cmd("Runtime.evaluate", {"expression": code_script})
