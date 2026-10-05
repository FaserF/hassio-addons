# Google Home Token Hub

<img src="https://raw.githubusercontent.com/FaserF/hassio-addons/master/.dev/googlehome/logo.png" width="100" alt="Logo" />

[![Open your Home Assistant instance and show the app dashboard.](https://my.home-assistant.io/badges/supervisor_addon.svg)](https://my.home-assistant.io/redirect/supervisor_addon/?addon=605cee21_googlehome)
[![Home Assistant App](https://img.shields.io/badge/home%20assistant-app-blue.svg)](https://www.home-assistant.io/apps/)
[![Docker Image](https://img.shields.io/badge/docker-0.1.2-blue.svg?logo=docker&style=flat-square)](https://github.com/FaserF/hassio-addons/pkgs/container/hassio-addons-googlehome)
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
>    ```text
>    https://github.com/FaserF/hassio-addons#edge
>    ```
> 3. Refresh the Add-on Store (⋮ → **Check for updates**), find this add-on under **FaserF's Home Assistant Apps (Edge)**, and click **Install**.

---

## 📖 About

**Google Home Token Hub** is an authentication gateway and token management add-on for Home Assistant. It simplifies Google authentication by automatically extracting permanent Master Tokens (`aas_et/...`), generating Spot/Nova API credentials, and handling End-to-End Encryption (E2EE) shared keys.

It powers both **Google Home** speaker control and **Google Find My Device** Bluetooth / device tracker tracking in Home Assistant without manual command-line token extractions.

## ✨ Features

- 🔑 **Master Token Generation:** Safely exchange credentials, Google App Passwords, or short-lived web tokens into permanent Master Tokens (`aas_et/...`).
- 📍 **Google Find My Device Hub:**
  - Dedicated authentication hub for the **[BSkando/GoogleFindMy-HA](https://github.com/BSkando/GoogleFindMy-HA)** integration.
  - Automatically mints ADM (Android Device Manager) OAuth tokens for Spot & Nova APIs.
  - Supports Google Accounts security domain unlock to retrieve End-to-End Encryption (E2EE) shared keys (`finder_hw`) required to decrypt real-time tracker locations.
  - Generates ready-to-use `secrets.json` and can deploy it directly into Home Assistant's `/config/custom_components/googlefindmy/Auth/secrets.json` with a single click.
- 🖥️ **Modern Ingress Web UI:** Clean, responsive dark-mode web dashboard featuring live session status, interactive 2FA challenge handling, token export, and dedicated Google Home & Google Find My tabs.
- 🔌 **Supervisor Auto-Discovery:** Seamless zero-touch handshake with the **[ha-googlehome](https://github.com/FaserF/ha-googlehome)** integration.
- 📦 **Auto-Install & Updates:** Automatically installs and keeps the `ha-googlehome` custom integration up to date in Home Assistant.

## 🔗 Supported Integrations

This add-on provides authentication and tokens for the following Home Assistant integrations:

1. **[ha-googlehome](https://github.com/FaserF/ha-googlehome)**
   - Custom Home Assistant integration for Google Home / Nest devices.
   - Provides 100% local control, alarms, timers, volume control, Do Not Disturb, and Night Mode switches.
   - Auto-discovered and auto-configured directly by this add-on.

2. **[GoogleFindMy-HA (BSkando/GoogleFindMy-HA)](https://github.com/BSkando/GoogleFindMy-HA)**
   - Google Find My Device tracker integration for Home Assistant.
   - Uses the ADM OAuth token and E2EE shared key generated in this add-on to track Chipolo, Pebblebee, Pixel, and other Google Find My network trackers.
   - Supports 1-click automatic secrets deployment straight to the integration folder.

---

## ⚙️ Configuration

Configure the app via the **Configuration** tab in the Home Assistant App page.

### Options

```yaml
auto_install_integration: true
auto_stop_timeout: 60
github_token: ''
log_level: info
```

---

## 👨‍💻 Credits & License

This project is open-source and available under the MIT License.
Maintained by **FaserF**.
