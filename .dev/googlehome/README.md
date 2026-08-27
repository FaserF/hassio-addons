# Google Home Token Hub

<img src="https://raw.githubusercontent.com/FaserF/hassio-addons/master/googlehome/logo.png" width="100" alt="Logo" />

[![Open your Home Assistant instance and show the app dashboard.](https://my.home-assistant.io/badges/supervisor_addon.svg)](https://my.home-assistant.io/redirect/supervisor_addon/?addon=605cee21_googlehome)
[![Home Assistant App](https://img.shields.io/badge/home%20assistant-app-blue.svg)](https://www.home-assistant.io/apps/)
[![Docker Image](https://img.shields.io/badge/docker-0.1.0-blue.svg?logo=docker&style=flat-square)](https://github.com/FaserF/hassio-addons/pkgs/container/hassio-addons-googlehome)
![Project Maintenance](https://img.shields.io/badge/maintainer-FaserF-blue?style=flat-square)

> Google Home Master Token Generator & Ingress Authentication Hub for Home Assistant.

---

> [!CAUTION]
> **In-Development Add-on (Edge Channel Only)**
>
> This add-on is currently in active development and excluded from the stable repository channel.
> While the Home Assistant add-on wrapper itself may be functional, the underlying upstream software is either in an early development stage or hosted within a private repository.
>
> ### 📦 How to Install via Edge Channel
>
> 1. Click to add the Edge repository:
>    [![Add Edge Repository](https://my.home-assistant.io/badges/supervisor_add_addon_repository.svg)](https://my.home-assistant.io/redirect/supervisor_add_addon_repository/?repository_url=https%3A%2F%2Fgithub.com%2FFaserF%2Fhassio-addons%23edge)
> 2. Or manually add repository in Home Assistant (**Settings** → **Add-ons** → **Add-on Store** → **⋮** → **Repositories**):
>
>    ```text
>    https://github.com/FaserF/hassio-addons#edge
>    ```
>
> 3. Refresh the Add-on Store (⋮ → **Check for updates**), find this add-on under **FaserF's Home Assistant Apps (Edge)**, and click **Install**.

---

## 📖 About

## ✨ Features

- 🔑 **Master Token Generation:** Safely exchange short-lived web tokens or Google App Passwords into permanent Master Tokens (`aas_et/...`).
- 🖥️ **Modern Ingress Web UI:** Clean, responsive dark-mode web dashboard displaying live token status and account linkage.
- 🔌 **Supervisor Auto-Discovery:** Seamless zero-touch handshake with the [Google Home Integration](https://github.com/FaserF/ha-googlehome).
- 📦 **Auto-Install & Updates:** Automatically installs and keeps the `ha-googlehome` custom integration up to date in Home Assistant.

## 🔗 Related Integration

This add-on works together with the **[ha-googlehome Home Assistant Custom Integration](https://github.com/FaserF/ha-googlehome)**:

- [ha-googlehome on GitHub](https://github.com/FaserF/ha-googlehome)
- Provides 100% local control, alarms, timers, volume, Do Not Disturb, and Night Mode entities.

---

## ⚙️ Configuration

Configure the app via the **Configuration** tab in the Home Assistant App page.

### Options

```yaml
auto_install_integration: true
github_token: ''
log_level: info
```

---

## 👨‍💻 Credits & License

This project is open-source and available under the MIT License.
Maintained by **FaserF**.
