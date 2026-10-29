# AegisBot

> [!CAUTION]
> **EDGE/DEVELOPMENT BUILD**
>
> You are viewing the `edge` branch. This version is built locally from source
> and may contain bugs or incomplete features. For stable releases, switch to
> the `master` branch or use the stable repository URL.



<img src="https://raw.githubusercontent.com/FaserF/hassio-addons/master/.dev/AegisBot/logo.png" width="100" alt="Logo" />

[![Open your Home Assistant instance and show the app dashboard.](https://my.home-assistant.io/badges/supervisor_addon.svg)](https://my.home-assistant.io/redirect/supervisor_addon/?addon=edfe50eb_AegisBot)
[![Home Assistant App](https://img.shields.io/badge/home%20assistant-app-blue.svg)](https://www.home-assistant.io/apps/)
[![Docker Image](https://img.shields.io/badge/docker-0.6.2-blue.svg?logo=docker&style=flat-square)](https://github.com/FaserF/hassio-addons/pkgs/container/hassio-addons-aegisbot)
![Project Maintenance](https://img.shields.io/badge/maintainer-FaserF-blue?style=flat-square)

> Professional Telegram Group Defender — Advanced Security, Automated Moderation, and Community Management.

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

Professional Telegram Group Defender — Advanced Security, Automated Moderation, and Community Management.

---

## ⚙️ Configuration

Configure the app via the **Configuration** tab in the Home Assistant App page.

### Options

```yaml
ai_provider: gemini
auto_install_integration: true
database:
  type: sqlite
debug: false
default_locale: en
demo_mode: false
demo_mode_type: ephemeral
developer_mode: false
environment: production
github_repo: FaserF/AegisBot
github_token: ''
log_level: info
project_name: AegisBot
release_type: stable
reset_database: false
secret_key: ''
version: latest
```

---

## 👨‍💻 Credits & License

This project is open-source and available under the MIT License.
Maintained by **FaserF**.
