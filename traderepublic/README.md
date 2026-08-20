# Trade Republic Headless Browser

<img src="https://raw.githubusercontent.com/FaserF/hassio-addons/master/traderepublic/logo.png" width="100" alt="Logo" />

[![Open your Home Assistant instance and show the app dashboard.](https://my.home-assistant.io/badges/supervisor_addon.svg)](https://my.home-assistant.io/redirect/supervisor_addon/?addon=605cee21_traderepublic)
[![Home Assistant App](https://img.shields.io/badge/home%20assistant-app-blue.svg)](https://www.home-assistant.io/apps/)
[![Docker Image](https://img.shields.io/badge/docker-0.1.0-blue.svg?logo=docker&style=flat-square)](https://github.com/FaserF/hassio-addons/pkgs/container/hassio-addons-traderepublic)
![Project Maintenance](https://img.shields.io/badge/maintainer-FaserF-blue?style=flat-square)

> Trade Republic Headless Browser & Session Provider (WAF Solver & Keep-Alive).

---

> [!CAUTION]
> **Experimental / Beta Status**
>
> This App is still in development and/or primarily developed for personal use.
> It is not extensively testet yet, but is expected to work fundamentally.

---

## 📖 About

﻿# Trade Republic Headless Browser (Home Assistant Add-on)

This Home Assistant Add-on provides an automated headless browser service powered by Chromium & Playwright. It solves AWS WAF Bot Control challenges and maintains persistent, auto-refreshed sessions for Trade Republic.

## ✨ Features

- 🛡️ **AWS WAF Solving:** Solves Cloudflare / AWS WAF Bot challenges natively using Alpine Chromium via Chrome DevTools Protocol (CDP).
- 📲 **In-Integration Setup:** Complete authentication (Credentials + In-App Approval / SMS) directly from the Home Assistant Integration setup flow without touching the App UI.
- 📱 **Ingress Web UI (Optional):** Clean Web UI for direct login, live status monitoring, and 1-click In-App verification.
- 🔄 **Keep-Alive & Auto-Renewal:** Keeps the browser session alive and automatically refreshes tokens in the background.
- 🔌 **Home Assistant Auto-Discovery:** Seamlessly connects with the [Trade Republic Home Assistant Integration](https://github.com/FaserF/ha-traderepublic).
- 📦 **Auto-Install & Update:** Automatically installs and keeps the `ha-traderepublic` integration up to date in `/config/custom_components`.

## 🚀 Installation & Setup

1. Add this repository to your Home Assistant App Store: <https://github.com/FaserF/hassio-addons>.
2. Install **Trade Republic Headless Browser** and start the app.
3. Open **Settings → Devices & Services** in Home Assistant:
   - The Trade Republic integration will automatically discover the App!
   - Follow the prompt to log in with your Phone Number & PIN.
   - Confirm the prompt on your Trade Republic smartphone app.
4. _Optional:_ You can also open the App's **Web UI** via Ingress to monitor status or log in manually.

---

## ⚙️ Configuration

Configure the app via the **Configuration** tab in the Home Assistant App page.

### Options

```yaml
auto_install_integration: true
github_token: ''
keep_alive_interval: 600
log_level: info
```

---

## 👨‍💻 Credits & License

This project is open-source and available under the MIT License.
Maintained by **FaserF**.
