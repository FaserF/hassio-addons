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

    async def extract_qr_code(self) -> Optional[str]:
        """Extract QR code as base64 data URI or screenshot from Trade Republic login page."""
        try:
            # 1. Check if the QR code is expired (.qrLoginCard__expired or blur overlay)
            expired_check_script = """
            (() => {
                const exp = document.querySelector('.qrLoginCard__expired, .qrLoginCard__refreshIcon, [class*="expired"]');
                if (exp && exp.offsetWidth > 0) {
                    const r = exp.getBoundingClientRect();
                    return { expired: true, x: r.x + r.width / 2, y: r.y + r.height / 2 };
                }
                return { expired: false };
            })()
            """
            exp_res = await self.cdp.send_cmd(
                "Runtime.evaluate", {"expression": expired_check_script, "returnByValue": True}
            )
            exp_val = exp_res and exp_res.get("result", {}).get("value")
            if exp_val and exp_val.get("expired"):
                _LOGGER.info("QR code expired overlay detected — clicking reload icon via CDP...")
                x = exp_val.get("x", 620)
                y = exp_val.get("y", 225)
                await self.cdp.click_at(x, y)
                await asyncio.sleep(1.5)

            # 2. Only switch back if no QR card is present on the page (e.g. if stuck in an error screen)
            qr_prep_script = """
            (() => {
                if (document.querySelector('.qrLoginCard, .qrCode__matrix')) {
                    return { action: 'already_present' };
                }
                const backBtn = document.querySelector('button[aria-label*="Back"], button[aria-label*="Zurück"], .loginFlow__backButton');
                if (backBtn && backBtn.offsetWidth > 0) {
                    backBtn.click();
                    return { action: 'clicked_back' };
                }
                return { action: 'none' };
            })()
            """
            prep_res = await self.cdp.send_cmd(
                "Runtime.evaluate", {"expression": qr_prep_script, "returnByValue": True}
            )
            action = prep_res and prep_res.get("result", {}).get("value", {}).get("action")
            if action == "clicked_back":
                await asyncio.sleep(1.0)

            # 3. Look for Canvas element with valid dimensions
            canvas_script = """
            (() => {
                const canvases = Array.from(document.querySelectorAll('canvas'));
                for (let c of canvases) {
                    if (c.offsetWidth >= 120 && c.offsetHeight >= 120) {
                        try {
                            return c.toDataURL('image/png');
                        } catch(e) {}
                    }
                }
                return null;
            })()
            """
            canvas_res = await self.cdp.send_cmd(
                "Runtime.evaluate", {"expression": canvas_script, "returnByValue": True}
            )
            canvas_val = canvas_res and canvas_res.get("result", {}).get("value")
            if canvas_val and isinstance(canvas_val, str) and canvas_val.startswith("data:image/png"):
                return canvas_val

            # 4. Screenshot the QR bounding box with a slight padding
            box_script = """
            (() => {
                const targetQr = document.querySelector('.qrLoginCard__qrSlot, .qrCode__matrix svg, [class*="qrCode"] svg');
                if (targetQr) {
                    const r = targetQr.getBoundingClientRect();
                    if (r.width >= 50 && r.height >= 50) {
                        return { x: r.x, y: r.y, width: r.width, height: r.height };
                    }
                }

                const qrSvg = Array.from(document.querySelectorAll('svg')).find(s => {
                    const r = s.getBoundingClientRect();
                    const isCrisp = s.getAttribute('shape-rendering') === 'crispEdges';
                    const is135 = s.getAttribute('viewBox') === '0 0 135 135';
                    const hasLotsOfPaths = (s.querySelectorAll('rect, path').length >= 10 || (s.innerHTML && s.innerHTML.includes('rect')));
                    return (isCrisp || is135 || hasLotsOfPaths) && r.width >= 50;
                });
                if (qrSvg) {
                    const r = qrSvg.getBoundingClientRect();
                    return { x: r.x, y: r.y, width: r.width, height: r.height };
                }

                const qrContainer = Array.from(document.querySelectorAll('div, img')).find(el => {
                    const r = el.getBoundingClientRect();
                    const testId = (el.getAttribute('data-testid') || '').toLowerCase();
                    const cls = (el.className || '').toString().toLowerCase();
                    return (testId.includes('qr') || cls.includes('qr')) && r.width >= 100 && r.height >= 100;
                });
                if (qrContainer) {
                    const r = qrContainer.getBoundingClientRect();
                    return { x: r.x, y: r.y, width: r.width, height: r.height };
                }

                return null;
            })()
            """
            box_res = await self.cdp.send_cmd("Runtime.evaluate", {"expression": box_script, "returnByValue": True})
            box = box_res and box_res.get("result", {}).get("value")
            if box and isinstance(box, dict) and box.get("width", 0) >= 50:
                pad = 8.0
                clip_params = {
                    "format": "png",
                    "clip": {
                        "x": max(0.0, float(box.get("x", 0)) - pad),
                        "y": max(0.0, float(box.get("y", 0)) - pad),
                        "width": float(box.get("width", 200)) + (pad * 2),
                        "height": float(box.get("height", 200)) + (pad * 2),
                        "scale": 2,
                    },
                }
                shot = await self.cdp.send_cmd("Page.captureScreenshot", clip_params)
                if shot and isinstance(shot, dict) and shot.get("data"):
                    return f"data:image/png;base64,{shot.get('data')}"

        except Exception as e:
            _LOGGER.debug("Failed to extract QR code: %s", e)
        return None

    async def execute_login(self, clean_phone: str, clean_pin: str) -> Dict[str, Any]:
        """Navigate to login, enter phone & PIN via trusted CDP events, and trigger push/SMS."""
        await self.cdp.send_cmd("Page.navigate", {"url": "https://app.traderepublic.com/login"})
        await asyncio.sleep(3.5)

        # 1. Accept cookies if present & wait for phone or PIN input to render
        for _ in range(8):
            prep_res = await self.cdp.send_cmd(
                "Runtime.evaluate",
                {
                    "expression": """
                    (() => {
                        const btns = Array.from(document.querySelectorAll('button'));
                        const acceptBtn = btns.find(b => b.textContent && (b.textContent.includes('Accept') || b.textContent.includes('Akzeptieren') || b.textContent.includes('Allow')));
                        if (acceptBtn) { acceptBtn.click(); }

                        const phoneInput = document.querySelector('input.phone-input__input, input[type="tel"], input[name="username"], input[autocomplete="tel-national"]');
                        const pinInput = document.querySelector('input[type="password"], input[autocomplete="current-password"]');
                        return {
                            hasPhone: !!(phoneInput && phoneInput.offsetWidth > 0),
                            hasPin: !!(pinInput && pinInput.offsetWidth > 0)
                        };
                    })()
                    """,
                    "returnByValue": True,
                },
            )
            prep_val = (prep_res or {}).get("result", {}).get("value") or {}
            if prep_val.get("hasPhone") or prep_val.get("hasPin"):
                break
            await asyncio.sleep(0.5)

        # 2. Prepare national number & preferred area code in localStorage if non-DE
        area_code = "+49"
        national_phone = clean_phone
        for prefix in (
            "+49",
            "+43",
            "+41",
            "+33",
            "+34",
            "+39",
            "+31",
            "+32",
            "+351",
            "+352",
            "+353",
            "+358",
            "+48",
            "+420",
        ):
            if clean_phone.startswith(prefix):
                area_code = prefix
                national_phone = clean_phone[len(prefix) :].lstrip("0")
                break
        else:
            if clean_phone.startswith("+"):
                national_phone = clean_phone[3:].lstrip("0")

        if area_code != "+49":
            await self.cdp.send_cmd(
                "Runtime.evaluate",
                {
                    "expression": f"try {{ localStorage.setItem('login_preferred_area_code', '{area_code}'); }} catch(e) {{}}"
                },
            )
            await self.cdp.send_cmd("Page.reload", {})
            await asyncio.sleep(3.0)

        # 3. Focus, clear, and insert phone number via trusted CDP Input.insertText
        phone_prep = await self.cdp.send_cmd(
            "Runtime.evaluate",
            {
                "expression": """
                (() => {
                    const inp = document.querySelector('input.phone-input__input, input[type="tel"], input[name="username"], input[autocomplete="tel-national"]');
                    if (!inp || inp.offsetWidth === 0) return { ok: false, reason: 'phone_input_not_found' };
                    inp.focus();
                    inp.value = '';
                    inp.dispatchEvent(new Event('input', { bubbles: true }));
                    const r = inp.getBoundingClientRect();
                    return { ok: true, x: r.left + r.width / 2, y: r.top + r.height / 2 };
                })()
                """,
                "returnByValue": True,
            },
        )
        phone_val = (phone_prep or {}).get("result", {}).get("value") or {}
        _LOGGER.info("CDP Phone prep result: %s", phone_val)
        if phone_val.get("ok"):
            await self.cdp.click_at(phone_val["x"], phone_val["y"])
            await asyncio.sleep(0.15)
            # Select all & delete any residual characters before inserting
            await self.cdp.send_cmd(
                "Runtime.evaluate",
                {"expression": """
                    (() => {
                        const inp = document.querySelector('input.phone-input__input, input[type="tel"], input[name="username"]');
                        if (inp) { inp.focus(); inp.select(); }
                    })()
                    """},
            )
            await self.cdp.send_cmd(
                "Input.dispatchKeyEvent",
                {"type": "keyDown", "key": "Backspace", "code": "Backspace", "windowsVirtualKeyCode": 8},
            )
            await self.cdp.send_cmd(
                "Input.dispatchKeyEvent",
                {"type": "keyUp", "key": "Backspace", "code": "Backspace", "windowsVirtualKeyCode": 8},
            )
            await self.cdp.insert_text(national_phone)
            await asyncio.sleep(1.0)

            # Check if PIN input appeared automatically (via Vue autofill/validity) or if we need to click submit
            pin_check = await self.cdp.send_cmd(
                "Runtime.evaluate",
                {
                    "expression": """
                    (() => {
                        const pin = document.querySelector('input[type="password"], input[autocomplete="current-password"]');
                        if (pin && pin.offsetWidth > 0) return { pinVisible: true };
                        const btn = document.querySelector('button.loginIconButton[type="submit"], form button[type="submit"]');
                        if (btn && btn.offsetWidth > 0) {
                            const r = btn.getBoundingClientRect();
                            return { pinVisible: false, btnX: r.left + r.width / 2, btnY: r.top + r.height / 2, disabled: btn.disabled };
                        }
                        return { pinVisible: false };
                    })()
                    """,
                    "returnByValue": True,
                },
            )
            p_chk = (pin_check or {}).get("result", {}).get("value") or {}
            if not p_chk.get("pinVisible") and p_chk.get("btnX"):
                await self.cdp.click_at(p_chk["btnX"], p_chk["btnY"])
                await asyncio.sleep(1.5)

        # 4. Wait up to 3s for PIN input (`input[type="password"]`) and enter PIN via CDP Input.insertText
        pin_box = None
        for _ in range(6):
            pin_res = await self.cdp.send_cmd(
                "Runtime.evaluate",
                {
                    "expression": """
                    (() => {
                        const pin = document.querySelector('input[type="password"], input[autocomplete="current-password"]');
                        if (!pin || pin.offsetWidth === 0) return { ok: false };
                        pin.focus();
                        pin.value = '';
                        pin.dispatchEvent(new Event('input', { bubbles: true }));
                        const r = pin.getBoundingClientRect();
                        return { ok: true, x: r.left + r.width / 2, y: r.top + r.height / 2 };
                    })()
                    """,
                    "returnByValue": True,
                },
            )
            pin_box = (pin_res or {}).get("result", {}).get("value") or {}
            if pin_box.get("ok"):
                break
            await asyncio.sleep(0.5)

        _LOGGER.info("CDP PIN prep result: %s", pin_box)
        if not pin_box or not pin_box.get("ok"):
            # Check if phone validation error is shown
            err_res = await self.cdp.send_cmd(
                "Runtime.evaluate",
                {
                    "expression": """
                    (() => {
                        const err = document.querySelector('.loginErrorMessage, [role="alert"], .phone-input__error');
                        return err ? err.textContent.trim() : null;
                    })()
                    """,
                    "returnByValue": True,
                },
            )
            err_txt = (err_res or {}).get("result", {}).get("value")
            return {
                "success": False,
                "error": err_txt or "Could not reach PIN entry step on Trade Republic login page.",
            }

        await self.cdp.click_at(pin_box["x"], pin_box["y"])
        await asyncio.sleep(0.15)
        await self.cdp.insert_text(clean_pin)
        await asyncio.sleep(0.5)

        # 5. Click PIN submit button or press Enter if not auto-submitted
        submit_res = await self.cdp.send_cmd(
            "Runtime.evaluate",
            {
                "expression": """
                (() => {
                    const btn = document.querySelector('button.loginIconButton[type="submit"], form button[type="submit"]');
                    if (btn && btn.offsetWidth > 0 && !btn.disabled) {
                        const r = btn.getBoundingClientRect();
                        return { canClick: true, x: r.left + r.width / 2, y: r.top + r.height / 2 };
                    }
                    return { canClick: false };
                })()
                """,
                "returnByValue": True,
            },
        )
        sub_val = (submit_res or {}).get("result", {}).get("value") or {}
        if sub_val.get("canClick"):
            await self.cdp.click_at(sub_val["x"], sub_val["y"])

        await asyncio.sleep(3.5)

        # 6. Inspect post-submit DOM state (ConfirmInApp, OTP/SMS, Authenticator, or Error)
        state_res = await self.cdp.send_cmd(
            "Runtime.evaluate",
            {
                "expression": """
                (() => {
                    const errEl = document.querySelector('.loginErrorMessage, [role="alert"], [data-testid="error-message"]');
                    const errText = (errEl && errEl.offsetWidth > 0 && errEl.textContent) ? errEl.textContent.trim() : null;
                    const confirmApp = !!document.querySelector('.confirmInAppForm, .countdownRing');
                    const otpForm = !!document.querySelector('.otpForm, input#sms-code-input');
                    const totpForm = !!document.querySelector('.authenticatorForm, input#totp-input');
                    const bodyTxt = document.body.innerText || '';
                    return {
                        error: errText,
                        confirmInApp: confirmApp,
                        otpForm: otpForm,
                        totpForm: totpForm,
                        bodySnippet: bodyTxt.substring(0, 400)
                    };
                })()
                """,
                "returnByValue": True,
            },
        )
        st = (state_res or {}).get("result", {}).get("value") or {}
        _LOGGER.info("Post-login DOM state: %s", st)

        if st.get("error"):
            _LOGGER.warning("Trade Republic login error shown in DOM: %s", st["error"])
            return {
                "success": False,
                "error": st["error"],
                "message": st["error"],
            }

        if st.get("otpForm"):
            return {
                "success": True,
                "step": "2fa_required",
                "flow": "otp",
                "message": "4-digit code sent! Please enter the 4-digit push/SMS code from your Trade Republic app.",
            }

        if st.get("totpForm"):
            return {
                "success": True,
                "step": "2fa_required",
                "flow": "totp",
                "message": "Please enter the 6-digit code from your Authenticator app.",
            }

        return {
            "success": True,
            "step": "2fa_required",
            "flow": "confirmInApp",
            "message": "Push notification sent! Please open your Trade Republic app and tap Confirm.",
        }

    async def submit_2fa_code(self, clean_code: str) -> None:
        """Submit 2FA verification code (4-digit OTP or 6-digit TOTP) via trusted CDP events."""
        if not clean_code:
            return
        code_prep = await self.cdp.send_cmd(
            "Runtime.evaluate",
            {
                "expression": """
                (() => {
                    const inp = document.querySelector('input#sms-code-input, input#totp-input, .otpForm input, .authenticatorForm input, input[autocomplete="one-time-code"]');
                    if (!inp || inp.offsetWidth === 0) return { ok: false };
                    inp.focus();
                    inp.value = '';
                    inp.dispatchEvent(new Event('input', { bubbles: true }));
                    const r = inp.getBoundingClientRect();
                    return { ok: true, x: r.left + r.width / 2, y: r.top + r.height / 2 };
                })()
                """,
                "returnByValue": True,
            },
        )
        c_val = (code_prep or {}).get("result", {}).get("value") or {}
        if c_val.get("ok"):
            await self.cdp.click_at(c_val["x"], c_val["y"])
            await asyncio.sleep(0.1)
            await self.cdp.insert_text(clean_code)
            await asyncio.sleep(0.4)
            btn_res = await self.cdp.send_cmd(
                "Runtime.evaluate",
                {
                    "expression": """
                    (() => {
                        const btn = document.querySelector('button.loginIconButton[type="submit"], form button[type="submit"]');
                        if (btn && btn.offsetWidth > 0 && !btn.disabled) {
                            const r = btn.getBoundingClientRect();
                            return { ok: true, x: r.left + r.width / 2, y: r.top + r.height / 2 };
                        }
                        return { ok: false };
                    })()
                    """,
                    "returnByValue": True,
                },
            )
            b_val = (btn_res or {}).get("result", {}).get("value") or {}
            if b_val.get("ok"):
                await self.cdp.click_at(b_val["x"], b_val["y"])
