# 🎮 Epic Games Freebies Claimer Add-on

[![Home Assistant Add-on](https://img.shields.io/badge/Home%20Assistant-Add--on-blue.svg)](https://github.com/FaserF/hassio-addons)
[![Supports aarch64 Architecture](https://img.shields.io/badge/aarch64-yes-green.svg)](https://github.com/FaserF/hassio-addons/tree/master/epicgamesfree)
[![Supports amd64 Architecture](https://img.shields.io/badge/amd64-yes-green.svg)](https://github.com/FaserF/hassio-addons/tree/master/epicgamesfree)
[![Version](https://img.shields.io/badge/version-0.1.0-blue.svg)](https://github.com/FaserF/hassio-addons/tree/master/epicgamesfree)

> **Automatically claim promotional free games from the Epic Games Store with persistent session caching and Home Assistant Integration bridge.**

---

## 🌟 Features

- 🔄 **Persistent Session Storage**: Stores authentication session cookies and tokens in `/data/session.json`. You login once and stay authenticated across add-on reboots and scheduled runs.
- ⏰ **Automated Claim Scheduler**: Claims free games automatically according to your cron schedule (defaults to **Thursday 17:10 (Europe/Berlin)** when new free games go live).
- 🌐 **Ingress Web Dashboard**: Interactive UI served directly inside your Home Assistant side panel (Port 3000). Check current claims, manually trigger claims, or inspect store items.
- 🔌 **REST API Bridge**: Native REST endpoints (`/api/status`, `/api/claim`, `/api/games`, `/api/auth`) for the [Home Assistant Epic Games Integration (`ha-epicgames`)](https://github.com/FaserF/ha-epicgames).
- 🛡️ **Container Isolation**: Runs safely in its own Docker environment without polluting Home Assistant Core.

---

## 📦 Installation

1. Add this repository to your Home Assistant Add-on Store:
   ```text
   https://github.com/FaserF/hassio-addons
   ```
2. Search for **Epic Games Freebies Claimer** and click **Install**.
3. Configure your options in the add-on configuration tab if needed.
4. Start the add-on and open the **Web UI** via the sidebar ingress link.

---

## ⚙️ Configuration

Example configuration:

```yaml
auto_claim: true
cron_schedule: "10 17 * * 4"
log_level: info
```

### Options Reference

| Option | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `auto_claim` | `bool` | `true` | Enables automatic background claiming. |
| `cron_schedule` | `str` | `10 17 * * 4` | Cron expression for claim checks (**Thursday 17:10**). |
| `log_level` | `str` | `info` | Logging verbosity (`trace`, `debug`, `info`, `warning`, `error`). |

---

## 🔗 Architecture & Home Assistant Integration

This add-on is designed to work standalone or in synergy with the **[ha-epicgames Custom Integration](https://github.com/FaserF/ha-epicgames)**.

| Feature | Add-on Only | Standalone Integration | Integration + Add-on (Recommended) |
| :--- | :---: | :---: | :---: |
| Free Games Calendar & Sensors | ❌ (Web UI only) | ✅ | ✅ |
| Background Auto-Claiming | ✅ | ⚠️ (Requires HA active) | ✅ |
| Ingress Web Dashboard & Captcha solver | ✅ | ❌ | ✅ |
| One-Click "Claim Now" Button in HA | ❌ | ⚠️ (API token required) | ✅ |
| Persistent Token Storage (`/data`) | ✅ | ❌ (in HA storage) | ✅ |

---

## 📜 License

MIT License. Open Source & Free.
