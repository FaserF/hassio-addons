# Epic Games Freebies Claimer

<img src="https://raw.githubusercontent.com/FaserF/hassio-addons/master/epicgamesfree/logo.png" width="100" alt="Logo" />

[![Open your Home Assistant instance and show the app dashboard.](https://my.home-assistant.io/badges/supervisor_addon.svg)](https://my.home-assistant.io/redirect/supervisor_addon/?addon=605cee21_epicgamesfree)
[![Home Assistant App](https://img.shields.io/badge/home%20assistant-app-blue.svg)](https://www.home-assistant.io/apps/)
[![Docker Image](https://img.shields.io/badge/docker-0.1.0-blue.svg?logo=docker&style=flat-square)](https://github.com/FaserF/hassio-addons/pkgs/container/hassio-addons-epicgamesfree)
![Project Maintenance](https://img.shields.io/badge/maintainer-FaserF-blue?style=flat-square)

> Automatically login, persist session in /data, and claim promotional free games from Epic Games Store

---

> [!CAUTION]
> **In-Development Add-on (Edge Channel Only)**
>
> This add-on is currently in active development and excluded from the stable repository channel.
> While the Home Assistant add-on wrapper itself may be functional, the underlying upstream software is either in an early development stage or hosted within a private repository.
>
> ### 📦 How to Install via Edge Channel
> 1. Click to add the Edge repository:
>    [![Add Edge Repository](https://my.home-assistant.io/badges/supervisor_add_addon_repository.svg)](https://my.home-assistant.io/redirect/supervisor_add_addon_repository/?repository_url=https%3A%2F%2Fgithub.com%2FFaserF%2Fhassio-addons%23edge)
> 2. Or manually add repository in Home Assistant (**Settings** → **Add-ons** → **Add-on Store** → **⋮** → **Repositories**):
>    ```text
>    https://github.com/FaserF/hassio-addons#edge
>    ```
> 3. Refresh the Add-on Store (⋮ → **Check for updates**), find this add-on under **FaserF's Home Assistant Apps (Edge)**, and click **Install**.

---

## 📖 About

## 🌟 Features

- 🔄 **Persistent Session Storage**: Stores authentication session cookies and tokens in `/data/session.json`. You login once and stay authenticated across add-on reboots and scheduled runs.
- ⏰ **Automated Claim Scheduler**: Claims free games automatically according to your cron schedule (defaults to **Thursday 17:10 (Europe/Berlin)** when new free games go live).
- 🌐 **Ingress Web Dashboard**: Interactive UI served directly inside your Home Assistant side panel (Port 3000). Check current claims, manually trigger claims, or inspect store items.
- 🔌 **REST API Bridge**: Native REST endpoints (`/api/status`, `/api/claim`, `/api/games`, `/api/auth`) for the [Home Assistant Epic Games Integration (`ha-epicgames`)](https://github.com/FaserF/ha-epicgames).
- 🛡️ **Container Isolation**: Runs safely in its own Docker environment without polluting Home Assistant Core.

## 📦 Installation

1. Add this repository to your Home Assistant Add-on Store:

   ```text
   https://github.com/FaserF/hassio-addons
   ```

2. Search for **Epic Games Freebies Claimer** and click **Install**.
3. Configure your options in the add-on configuration tab if needed.
4. Start the add-on and open the **Web UI** via the sidebar ingress link.

## 🔗 Architecture & Home Assistant Integration

This add-on is designed to work standalone or in synergy with the **[ha-epicgames Custom Integration](https://github.com/FaserF/ha-epicgames)**.

| Feature                                |   Add-on Only    | Standalone Integration  | Integration + Add-on (Recommended) |
| :------------------------------------- | :--------------: | :---------------------: | :--------------------------------: |
| Free Games Calendar & Sensors          | ❌ (Web UI only) |           ✅            |                 ✅                 |
| Background Auto-Claiming               |        ✅        | ⚠️ (Requires HA active) |                 ✅                 |
| Ingress Web Dashboard & Captcha solver |        ✅        |           ❌            |                 ✅                 |
| One-Click "Claim Now" Button in HA     |        ❌        | ⚠️ (API token required) |                 ✅                 |
| Persistent Token Storage (`/data`)     |        ✅        |   ❌ (in HA storage)    |                 ✅                 |

## 📜 License

MIT License. Open Source & Free.

---

## ⚙️ Configuration

Configure the app via the **Configuration** tab in the Home Assistant App page.

### Options

```yaml
auto_claim: true
cron_schedule: 10 17 * * 4
log_level: info
```

---

## 👨‍💻 Credits & License

This project is open-source and available under the MIT License.
Maintained by **FaserF**.
