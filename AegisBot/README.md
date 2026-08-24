# AegisBot

<img src="https://raw.githubusercontent.com/FaserF/hassio-addons/master/AegisBot/logo.png" width="100" alt="Logo" />

[![Open your Home Assistant instance and show the app dashboard.](https://my.home-assistant.io/badges/supervisor_addon.svg)](https://my.home-assistant.io/redirect/supervisor_addon/?addon=605cee21_AegisBot)
[![Home Assistant App](https://img.shields.io/badge/home%20assistant-app-blue.svg)](https://www.home-assistant.io/apps/)
[![Docker Image](https://img.shields.io/badge/docker-0.6.2-blue.svg?logo=docker&style=flat-square)](https://github.com/FaserF/hassio-addons/pkgs/container/hassio-addons-aegisbot)
![Project Maintenance](https://img.shields.io/badge/maintainer-FaserF-blue?style=flat-square)

> Professional Telegram Group Defender — Advanced Security, Automated Moderation, and Community Management.

---

> [!CAUTION]
> **Development / Edge Channel Only**
>
> This add-on is currently in active development and provided exclusively on the **Edge** branch.
> While the Home Assistant add-on wrapper itself may be functional, the underlying upstream software is either in an early development stage or hosted within a private repository.
>
> 💡 To test or use this add-on, install the repository via the Edge channel: `https://github.com/FaserF/hassio-addons#edge`

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
