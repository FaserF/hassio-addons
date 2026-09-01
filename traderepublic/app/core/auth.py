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
            # 1. First ensure we are in QR mode (switch back if in phone mode or if expired button is shown)
            qr_prep_script = """
            (() => {
                // If there is an expired QR reload button or overlay, click it
                const allElements = Array.from(document.querySelectorAll('button, div[role="button"], a, svg, span, p'));
                const reloadBtn = allElements.find(el => {
                    const txt = (el.textContent || '').trim().toLowerCase();
                    const aria = (el.getAttribute('aria-label') || '').toLowerCase();
                    const testId = (el.getAttribute('data-testid') || '').toLowerCase();
                    return (
                        txt.includes('abgelaufen') || txt.includes('neu laden') || txt.includes('erneuern') ||
                        txt.includes('refresh') || txt.includes('reload') || txt.includes('aktualisieren') ||
                        aria.includes('refresh') || aria.includes('reload') || testId.includes('refresh') || testId.includes('reload')
                    ) && el.offsetWidth > 0 && el.offsetHeight > 0;
                });
                if (reloadBtn) {
                    reloadBtn.click();
                    return { action: 'clicked_reload' };
                }

                // If currently on phone login form, switch to QR login if link/button available
                const qrSwitchBtn = allElements.find(el => {
                    const txt = (el.textContent || '').trim().toLowerCase();
                    return (txt.includes('qr-code') || txt.includes('qr code') || txt.includes('mit qr')) && el.offsetWidth > 0;
                });
                if (qrSwitchBtn) {
                    qrSwitchBtn.click();
                    return { action: 'switched_to_qr' };
                }

                return { action: 'none' };
            })()
            """
            prep_res = await self.cdp.send_cmd("Runtime.evaluate", {"expression": qr_prep_script, "returnByValue": True})
            action = prep_res and prep_res.get("result", {}).get("value", {}).get("action")
            if action in ("clicked_reload", "switched_to_qr"):
                await asyncio.sleep(2.0)

            # 2. Look for Canvas element with valid dimensions
            canvas_script = """
            (() => {
                const canvases = Array.from(document.querySelectorAll('canvas'));
                for (let c of canvases) {
                    if (c.offsetWidth >= 140 && c.offsetHeight >= 140) {
                        try {
                            return c.toDataURL('image/png');
                        } catch(e) {}
                    }
                }
                return null;
            })()
            """
            canvas_res = await self.cdp.send_cmd("Runtime.evaluate", {"expression": canvas_script, "returnByValue": True})
            canvas_val = canvas_res and canvas_res.get("result", {}).get("value")
            if canvas_val and isinstance(canvas_val, str) and canvas_val.startswith("data:image/png"):
                return canvas_val

            # 3. Locate the bounding box of the full QR container and screenshot via CDP
            box_script = """
            (() => {
                const candidates = Array.from(document.querySelectorAll('div, section, main, [data-testid*="qr"], svg'));
                const qrContainers = candidates.filter(el => {
                    const r = el.getBoundingClientRect();
                    const isSquare = Math.abs(r.width - r.height) < 40;
                    const isProperSize = r.width >= 150 && r.width <= 450 && r.height >= 150 && r.height <= 450;
                    const isVisible = r.top >= 0 && r.left >= 0 && (r.top + r.height) <= window.innerHeight + 200;
                    if (!isSquare || !isProperSize || !isVisible) return false;
                    
                    const hasGraphic = el.querySelector('svg, canvas, img') !== null || el.tagName.toLowerCase() === 'svg';
                    return hasGraphic;
                });

                if (qrContainers.length > 0) {
                    // Sort descending by area to get the outer QR wrapper containing both the matrix and center icon
                    qrContainers.sort((a, b) => {
                        const ra = a.getBoundingClientRect();
                        const rb = b.getBoundingClientRect();
                        return (rb.width * rb.height) - (ra.width * ra.height);
                    });
                    // Pick candidate around ~180px - 320px
                    const best = qrContainers.find(el => {
                        const r = el.getBoundingClientRect();
                        return r.width >= 180 && r.width <= 320;
                    }) || qrContainers[0];

                    const r = best.getBoundingClientRect();
                    return { x: r.x, y: r.y, width: r.width, height: r.height };
                }
                return null;
            })()
            """
            box_res = await self.cdp.send_cmd("Runtime.evaluate", {"expression": box_script, "returnByValue": True})
            box = box_res and box_res.get("result", {}).get("value")
            if box and isinstance(box, dict) and box.get("width", 0) >= 140:
                clip_params = {
                    "format": "png",
                    "clip": {
                        "x": float(box.get("x", 0)),
                        "y": float(box.get("y", 0)),
                        "width": float(box.get("width", 200)),
                        "height": float(box.get("height", 200)),
                        "scale": 2,
                    },
                }
                shot = await self.cdp.send_cmd("Page.captureScreenshot", clip_params)
                if shot and isinstance(shot, dict) and shot.get("data"):
                    return f"data:image/png;base64,{shot.get('data')}"

            # 4. Fallback: Full SVG with QR pattern (> 20 paths/rects)
            svg_script = """
            (() => {
                const svgs = Array.from(document.querySelectorAll('svg'));
                for (let s of svgs) {
                    const rect = s.getBoundingClientRect();
                    const rectCount = s.querySelectorAll('rect, path').length;
                    if (rectCount >= 30 && rect.width >= 140) {
                        try {
                            const xml = new XMLSerializer().serializeToString(s);
                            return 'data:image/svg+xml;utf8,' + encodeURIComponent(xml);
                        } catch(e) {}
                    }
                }
                return null;
            })()
            """
            svg_res = await self.cdp.send_cmd("Runtime.evaluate", {"expression": svg_script, "returnByValue": True})
            svg_val = svg_res and svg_res.get("result", {}).get("value")
            if svg_val and isinstance(svg_val, str) and svg_val.startswith("data:image/svg+xml"):
                return svg_val

        except Exception as e:
            _LOGGER.debug("Failed to extract QR code: %s", e)
        return None

    async def execute_login(self, clean_phone: str, clean_pin: str) -> Dict[str, Any]:
        """Navigate to login, enter credentials, solve challenge and trigger push/SMS."""
        await self.cdp.send_cmd("Page.navigate", {"url": "https://app.traderepublic.com/login"})
        await asyncio.sleep(4)

        # 0. Cookie banner & Login Mode Check (Switch from QR-Code to Phone Login if necessary)
        prep_script = """
        (() => {
            // 1. Accept cookies
            const btns = Array.from(document.querySelectorAll('button'));
            const acceptBtn = btns.find(b => b.textContent && (b.textContent.includes('Accept') || b.textContent.includes('Akzeptieren') || b.textContent.includes('Allow')));
            if (acceptBtn) { acceptBtn.click(); }

            // 2. Check if already on phone input screen
            const visibleInputs = Array.from(document.querySelectorAll('input')).filter(i => i.offsetWidth > 0 && i.offsetHeight > 0);
            if (visibleInputs.length > 0) {
                return { switched_mode: true, reason: 'inputs_already_visible' };
            }

            // 3. Find switch button/link (all languages & data-testids)
            const elements = Array.from(document.querySelectorAll('button, a, div[role="button"], span, p'));
            const switchBtn = elements.find(el => {
                const txt = (el.textContent || '').trim().toLowerCase();
                const testId = (el.getAttribute('data-testid') || '').toLowerCase();
                const href = (el.getAttribute('href') || '').toLowerCase();
                const aria = (el.getAttribute('aria-label') || '').toLowerCase();
                return (
                    txt.includes('telefon') || txt.includes('phone') || txt.includes('handy') ||
                    txt.includes('ohne qr') || txt.includes('without qr') || txt.includes('andere') ||
                    txt.includes('zugangsdaten') || txt.includes('credentials') || txt.includes('manuell') ||
                    txt.includes('manual') || txt.includes('numéro') || txt.includes('número') ||
                    testId.includes('phone') || testId.includes('switch') || testId.includes('credentials') ||
                    href.includes('phone') || href.includes('credentials') || aria.includes('phone')
                ) && el.offsetWidth > 0;
            });

            if (switchBtn) {
                switchBtn.click();
                return { switched_mode: true, text: switchBtn.textContent.trim() };
            }

            // If no specific text matched, try any other visible button on the page
            const otherBtns = btns.filter(b => b !== acceptBtn && b.offsetWidth > 0 && b.offsetHeight > 0);
            if (otherBtns.length > 0) {
                otherBtns[0].click();
                return { switched_mode: true, text: otherBtns[0].textContent.trim(), fallback: true };
            }

            return { switched_mode: false };
        })()
        """
        prep_res = await self.cdp.send_cmd("Runtime.evaluate", {"expression": prep_script, "returnByValue": True})
        _LOGGER.info("CDP Login Prep result: %s", prep_res)
        await asyncio.sleep(2.5)

        # Phone Number Input & Submit
        phone_script = f"""
        (() => {{
            const inputs = Array.from(document.querySelectorAll('input')).filter(i => i.offsetWidth > 0 && i.offsetHeight > 0);
            const input = inputs.find(i => {{
                const name = (i.getAttribute('name') || '').toLowerCase();
                const type = (i.getAttribute('type') || '').toLowerCase();
                const auto = (i.getAttribute('autocomplete') || '').toLowerCase();
                const place = (i.getAttribute('placeholder') || '').toLowerCase();
                return name.includes('phone') || type === 'tel' || auto.includes('tel') || place.includes('phone') || place.includes('telefon') || place.includes('handy') || (type === 'text' && !name.includes('pin'));
            }}) || inputs[0];

            if (!input) return {{ ok: false, stage: 'phone', reason: 'input_not_found', total_inputs: inputs.length }};
            input.focus();
            input.click();
            const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
            nativeSetter.call(input, "{clean_phone}");
            input.dispatchEvent(new Event('input', {{ bubbles: true, composed: true }}));
            input.dispatchEvent(new Event('change', {{ bubbles: true, composed: true }}));
            input.dispatchEvent(new KeyboardEvent('keydown', {{ bubbles: true, composed: true, key: 'Enter', code: 'Enter', keyCode: 13, which: 13 }}));
            input.dispatchEvent(new KeyboardEvent('keypress', {{ bubbles: true, composed: true, key: 'Enter', code: 'Enter', keyCode: 13, which: 13 }}));
            input.dispatchEvent(new KeyboardEvent('keyup', {{ bubbles: true, composed: true, key: 'Enter', code: 'Enter', keyCode: 13, which: 13 }}));

            // Find visible submit button
            const btns = Array.from(document.querySelectorAll('button, div[role="button"]')).filter(b => b.offsetWidth > 0 && b.offsetHeight > 0);
            const btn = btns.find(b => {{
                const text = (b.textContent || '').trim().toLowerCase();
                const testId = (b.getAttribute('data-testid') || '').toLowerCase();
                const type = (b.getAttribute('type') || '').toLowerCase();
                const isSubmit = type === 'submit' || testId.includes('submit') || testId.includes('next');
                const hasText = ['weiter', 'next', 'continue', 'anmelden', 'login', 'senden', 'submit'].some(k => text === k || text.includes(k));
                return isSubmit || hasText;
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

            const btns = Array.from(document.querySelectorAll('button, div[role="button"], a[role="button"]')).filter(b => b.offsetWidth > 0 && b.offsetHeight > 0);
            const btn = btns.find(b => {{
                const text = (b.textContent || '').trim().toLowerCase();
                const testId = (b.getAttribute('data-testid') || '').toLowerCase();
                const type = (b.getAttribute('type') || '').toLowerCase();
                const isSubmit = type === 'submit' || testId.includes('submit') || testId.includes('login') || testId.includes('pin');
                const hasText = ['anmelden', 'login', 'weiter', 'next', 'submit', 'bestätigen', 'confirm'].some(k => text === k || text.includes(k));
                return isSubmit || hasText;
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

        await asyncio.sleep(4.0)

        # Check performance logs for auth requests
        network_spy_script = """
        (() => {
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
        has_auth_call = bool(network_calls and ("auth/web/login" in str(network_calls) or "v1/auth" in str(network_calls)))
        if network_calls:
            _LOGGER.info("TR network calls after submit: %s (has_auth_call: %s)", network_calls, has_auth_call)

        # In-Page API Fallback: If DOM interaction did not trigger auth API call, execute in-page fetch with solved WAF context
        if not has_auth_call:
            _LOGGER.info("DOM interaction did not produce auth call, executing in-page direct API fetch...")
            in_page_fetch_script = f"""
            (async () => {{
                try {{
                    const res = await fetch('https://api.traderepublic.com/api/v1/auth/web/login', {{
                        method: 'POST',
                        headers: {{
                            'Content-Type': 'application/json',
                            'Accept': 'application/json'
                        }},
                        body: JSON.stringify({{
                            phoneNumber: "{clean_phone}",
                            pin: "{clean_pin}"
                        }})
                    }});
                    const st = res.status;
                    const txt = await res.text();
                    let d = null;
                    try {{ d = JSON.parse(txt); }} catch(e) {{}}
                    return {{ ok: res.ok, status: st, data: d, raw: txt }};
                }} catch(err) {{
                    return {{ ok: false, error: err.toString() }};
                }}
            }})()
            """
            fetch_res = await self.cdp.send_cmd(
                "Runtime.evaluate", {"expression": in_page_fetch_script, "awaitPromise": True, "returnByValue": True}
            )
            fetch_val = fetch_res and fetch_res.get("result", {}).get("value")
            _LOGGER.info("In-page fetch login result: %s", fetch_val)
            if fetch_val and isinstance(fetch_val, dict):
                if fetch_val.get("ok"):
                    data = fetch_val.get("data") or {}
                    if data.get("processId"):
                        self._last_process_id = data.get("processId")
                    return {
                        "success": True,
                        "message": "Push notification sent. Please tap Confirm in your Trade Republic app.",
                    }
                elif fetch_val.get("status") in (400, 401, 403, 429):
                    data = fetch_val.get("data") or {}
                    err_msg = data.get("message") or data.get("error") or f"HTTP {fetch_val.get('status')}"
                    return {
                        "success": False,
                        "error": f"Trade Republic login rejected: {err_msg}",
                    }

        # Check current page URL
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
