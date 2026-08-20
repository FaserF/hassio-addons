# Trade Republic Headless Browser (Home Assistant Add-on)

This Home Assistant Add-on provides an automated headless browser service powered by Chromium & Playwright. It solves AWS WAF Bot Control challenges and maintains persistent, auto-refreshed sessions for Trade Republic.

## ✨ Features
- 🛡️ **AWS WAF Solving:** Solves Cloudflare / AWS WAF Bot challenges natively.
- 📱 **Ingress Web UI:** Easily log in and confirm 2FA without opening desktop developer tools.
- 🔄 **Keep-Alive & Auto-Renewal:** Keeps the browser session alive and automatically refreshes tokens in the background.
- 🔌 **Home Assistant Auto-Discovery:** Seamlessly connects with the [Trade Republic Home Assistant Integration](https://github.com/FaserF/ha-traderepublic).

## 🚀 Installation & Setup
1. Add this repository to your Home Assistant Add-on Store: https://github.com/FaserF/hassio-addons.
2. Install **Trade Republic Headless Browser** and start the add-on.
3. Open the **Web UI** via Ingress to perform the initial login.
4. Set up the [Trade Republic Integration](https://github.com/FaserF/ha-traderepublic) in Home Assistant. It will automatically discover the add-on.