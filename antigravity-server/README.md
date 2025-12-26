# Antigravity-Server

![Logo](logo.png)

[![Open your Home Assistant instance and show the add-on dashboard.](https://my.home-assistant.io/badges/supervisor_addon.svg)](https://my.home-assistant.io/redirect/supervisor_addon/?addon=c1e285b7_antigravity-server)
[![Home Assistant Add-on](https://img.shields.io/badge/home%20assistant-addon-blue.svg)](https://www.home-assistant.io/addons/)
[![GitHub Release](https://img.shields.io/github/v/release/FaserF/hassio-addons?include_prereleases&style=flat-square)](https://github.com/FaserF/hassio-addons/releases)
![Project Maintenance](https://img.shields.io/badge/maintainer-FaserF-blue?style=flat-square)

> Stream the Antigravity AI IDE (Linux Desktop with XFCE4) via NoVNC in your browser.

---

> [!CAUTION]
> **Experimental / Beta Status**
>
> This add-on is still in development and/or primarily developed for personal use.
> It is not extensively tested yet, but is expected to work fundamentally.

---

## 📖 About

- **🖥️ Browser-Based Desktop**: Access a full XFCE4 desktop via NoVNC
- **🔒 Ingress Support**: Secure access through the Home Assistant sidebar
- **🛠️ Pre-installed Tools**:
  - Google Chrome
  - Git & LazyGit
  - Node.js v22.x
  - Python 3.13
  - Docker-in-Docker support
- **💾 Persistent Storage**: User settings and files are preserved

## ⚠️ Requirements

> **Architecture**: This add-on only supports **amd64** systems.
> ARM devices (Raspberry Pi, etc.) are not supported by the upstream project.

## 🚀 Installation

1. Add this repository to your **Home Assistant Add-on Store**.
1. Install the **Antigravity-Server** add-on.
1. Review the **Configuration** options below.
1. Start the add-on.
1. Click **"OPEN WEB UI"** to launch the desktop interface.

---

## ⚙️ Configuration

Configure the add-on via the **Configuration** tab in the Home Assistant add-on page.

### Options

```yaml
log_level: info
vnc_password: ''
```

#### Option: `vnc_password` (Optional)

Set a custom VNC password (max 8 characters).

**If left empty (Default):**
*   A secure random password is generated on the first start.
*   **Storage**: Saved in `/data/vnc_password` to ensure it stays the same across restarts (Persistent).
*   **Visibility**: Printed prominently in the Add-on logs so you can copy it.

#### Option: `log_level` (Optional)

Controls the level of log output.

---

## 👨‍💻 Credits & License

This project is open-source and available under the MIT License.
Maintained by **FaserF**.
