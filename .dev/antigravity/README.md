# Antigravity

<img src="https://raw.githubusercontent.com/FaserF/hassio-addons/master/.dev/antigravity/logo.png" width="100" alt="Logo" />

[![Open your Home Assistant instance and show the app dashboard.](https://my.home-assistant.io/badges/supervisor_addon.svg)](https://my.home-assistant.io/redirect/supervisor_addon/?addon=605cee21_antigravity)
[![Home Assistant App](https://img.shields.io/badge/home%20assistant-app-blue.svg)](https://www.home-assistant.io/apps/)
[![Docker Image](https://img.shields.io/badge/docker-0.1.0-blue.svg?logo=docker&style=flat-square)](https://github.com/FaserF/hassio-addons/pkgs/container/hassio-addons-antigravity)
![Project Maintenance](https://img.shields.io/badge/maintainer-FaserF-blue?style=flat-square)

> Google Antigravity Quota Monitor, Multi-Account Dashboard, and Dynamic Polling Gateway for Home Assistant.

---

> [!CAUTION]
> **In-Development Add-on**
>
> This add-on is currently in active development and excluded from the stable repository channel.
> While the Home Assistant add-on wrapper itself may be functional, the underlying upstream software is either in an early development stage or hosted within a private repository.
>
> ### 📦 How to Install
>
> **Option A: Dev Channel (In-Dev Add-ons Only — Recommended)**
> 1. Click to add the Dev repository:
>    [![Add Dev Repository](https://my.home-assistant.io/badges/supervisor_add_addon_repository.svg)](https://my.home-assistant.io/redirect/supervisor_add_addon_repository/?repository_url=https%3A%2F%2Fgithub.com%2FFaserF%2Fhassio-addons%23dev)
> 2. Or manually add repository in Home Assistant (**Settings** → **Add-ons** → **Add-on Store** → **⋮** → **Repositories**):
>    ```text
>    https://github.com/FaserF/hassio-addons#dev
>    ```
>
> **Option B: Edge Channel (All Add-ons)**
> - Repository URL: `https://github.com/FaserF/hassio-addons#edge`
>
> 💡 *After adding the repository, refresh the Add-on Store (⋮ → Check for updates) to install.*

---

## 📖 About

## Highlights

- ⚡ **Dynamic & Adaptive Polling**: Automatically ramps up checks (every 3 minutes) during active coding sessions, and scales down (every 60 minutes) when idle.
- 🔄 **Manual "Refresh Now"**: Ingress Web UI button for on-demand quota synchronizations.
- 👥 **Multi-Account OAuth**: Monitor multiple personal and enterprise Google accounts side by side.
- 📊 **Modern Dark Ingress Web UI**: Circular progress gauges for 5-hour rolling limits and weekly quotas, reset countdowns, credits tracking, and model breakdown.
- 🔗 **Home Assistant Integration Ready**: Pairs with `ha-antigravity` integration to expose sensors, binary sensors, and services directly into Home Assistant.

## Quick Start

1. Add this repository to your Home Assistant Addon Store.
2. Install **Antigravity**.
3. Open the **Configuration** tab and configure your accounts or use the built-in demo mode.
4. Start the Addon and click **Open Web UI**.
5. Use the in-app **Setup Guide** to test and verify your Google OAuth refresh tokens.

## Documentation

For full setup guides and configuration options, see [DOCS.md](DOCS.md).

---

## ⚙️ Configuration

Configure the app via the **Configuration** tab in the Home Assistant App page.

### Options

```yaml
accounts:
  - client_id: ''
    client_secret: ''
    name: Primary Account
    project_id: ''
    refresh_token: ''
adaptive_polling: true
fast_poll_interval: 180
idle_backoff_interval: 3600
log_level: info
scan_interval: 1800
```

---

## 👨‍💻 Credits & License

This project is open-source and available under the MIT License.
Maintained by **FaserF**.
