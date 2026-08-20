import asyncio
import json
import logging
from typing import Any, Dict, Optional

import aiohttp

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
                    cname = cookie.get("name", "")
                    if cname in ("tr_session", "sessionToken", "tr_session_id", "auth_token"):
                        token = cookie.get("value")
                        if token and (token.startswith("eyJ") or len(token) > 40):
                            return token

        # 2. Check localStorage & sessionStorage
        storage_script = """
        (() => {
            try {
                for (let i = 0; i < localStorage.length; i++) {
                    const k = localStorage.key(i);
                    const v = localStorage.getItem(k);
                    if (v && typeof v === 'string') {
                        if (k === 'sessionToken' || k === 'tr_session' || k.includes('session') || k.includes('auth')) {
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
                for (let i = 0; i < sessionStorage.length; i++) {
                    const k = sessionStorage.key(i);
                    const v = sessionStorage.getItem(k);
                    if (v && typeof v === 'string' && (v.startsWith('eyJ') || v.length > 30)) return v;
                }
            } catch(e) {}
            return null;
        })()
        """
        storage_res = await self.cdp.send_cmd(
            "Runtime.evaluate", {"expression": storage_script, "returnByValue": True}
        )
        if storage_res and isinstance(storage_res, dict):
            val = storage_res.get("result", {}).get("value")
            if val and isinstance(val, str) and (val.startswith("eyJ") or len(val) > 30):
                return val.strip().strip('"').strip("'")

        # 3. Check document.cookie via Runtime evaluation
        eval_script = """
        (() => {
            const match = document.cookie.match(/(?:tr_session|sessionToken)=([^;]+)/);
            if (match && match[1] && (match[1].startsWith('eyJ') || match[1].length > 30)) return match[1];
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
        await self.cdp.send_cmd("Runtime.evaluate", {"expression": phone_script})
        await asyncio.sleep(3)

        # PIN
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
        await self.cdp.send_cmd("Runtime.evaluate", {"expression": pin_script, "returnByValue": True})

        # Direct API Request
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
                        if "errors" in err_data and isinstance(err_data["errors"], list) and len(err_data["errors"]) > 0:
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

        dom_error_script = """
        (() => {
            const errEl = document.querySelector('[role="alert"], [data-testid="error-message"], .error, .alert');
            if (errEl && errEl.textContent) return errEl.textContent.trim();
            return null;
        })()
        """
        dom_err = await self.cdp.send_cmd(
            "Runtime.evaluate", {"expression": dom_error_script, "returnByValue": True}
        )
        dom_err_text = dom_err and dom_err.get("result", {}).get("value")

        return {
            "success": True,
            "message": dom_err_text or api_feedback_msg or "Credentials submitted. Please confirm in your Trade Republic smartphone app.",
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
