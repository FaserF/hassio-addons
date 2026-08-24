# Trade Republic Headless Browser

<img src="https://raw.githubusercontent.com/FaserF/hassio-addons/master/traderepublic/logo.png" width="100" alt="Logo" />

[![Open your Home Assistant instance and show the app dashboard.](https://my.home-assistant.io/badges/supervisor_addon.svg)](https://my.home-assistant.io/redirect/supervisor_addon/?addon=605cee21_traderepublic)
[![Home Assistant App](https://img.shields.io/badge/home%20assistant-app-blue.svg)](https://www.home-assistant.io/apps/)
[![Docker Image](https://img.shields.io/badge/docker-1.0.0-blue.svg?logo=docker&style=flat-square)](https://github.com/FaserF/hassio-addons/pkgs/container/hassio-addons-traderepublic)
![Project Maintenance](https://img.shields.io/badge/maintainer-FaserF-blue?style=flat-square)

> Trade Republic Headless Browser & Session Provider (WAF Solver & Keep-Alive).

---

## 📖 About

﻿# Trade Republic Headless Browser (Home Assistant Add-on)

This Home Assistant Add-on provides an automated headless browser service powered by Chromium & Playwright. It solves AWS WAF Bot Control challenges and maintains persistent, auto-refreshed sessions for Trade Republic.

## ✨ Features

- 🛡️ **AWS WAF Solving:** Solves Cloudflare / AWS WAF Bot challenges natively using Alpine Chromium via Chrome DevTools Protocol (CDP).
- 📲 **In-Integration Setup:** Complete authentication (Credentials + In-App Approval / SMS) directly from the Home Assistant Integration setup flow without touching the App UI.
- 📱 **Modern Ingress Dashboard:** Clean Web UI with live connection health, Home Assistant query counters, diagnostic error alerts, and 1-click In-App verification.
- 🔄 **Keep-Alive & Auto-Renewal:** Keeps the browser session alive and automatically refreshes tokens in the background.
- 🔌 **Home Assistant Auto-Discovery & Zero-Touch Connect:** Seamlessly connects with the [Trade Republic Home Assistant Integration](https://github.com/FaserF/ha-traderepublic) without re-entering credentials if already active.
- 🌍 **Full International Support:** Formats and validates all international country codes (+49, +33, +34, +43, +41, etc.) and German national 01... numbers.
- 📦 **Auto-Install & Update:** Automatically installs and keeps the `ha-traderepublic` integration up to date in `/config/custom_components`.

## 🚀 Installation & Setup

1. Add this repository to your Home Assistant App Store: <https://github.com/FaserF/hassio-addons>.
2. Install **Trade Republic Headless Browser** and start the app.
3. Open **Settings → Devices & Services** in Home Assistant:
   - The Trade Republic integration will automatically discover the App!
   - If already logged in, it connects with 1 click without needing phone or PIN.
   - Otherwise, follow the guided prompt to log in and confirm on your smartphone.
4. _Optional:_ Open the App's **Web UI** via Ingress to monitor status, review query activity, or re-authenticate.

## ℹ️ Session Persistence & Add-on Restarts

---

## ⚙️ Configuration

Configure the app via the **Configuration** tab in the Home Assistant App page.

### Options

```yaml
auto_install_integration: true
cache_retention_hours: 12
github_token: ''
keep_alive_interval: 600
log_level: info
```

---

## 👨‍💻 Credits & License

This project is open-source and available under the MIT License.
Maintained by **FaserF**.
