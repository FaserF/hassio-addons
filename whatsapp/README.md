# WhatsApp

<img src="https://raw.githubusercontent.com/FaserF/hassio-addons/master/whatsapp/logo.png" width="100" alt="Logo" />

[![Open your Home Assistant instance and show the app dashboard.](https://my.home-assistant.io/badges/supervisor_addon.svg)](https://my.home-assistant.io/redirect/supervisor_addon/?addon=c1e285b7_whatsapp)
[![Home Assistant App](https://img.shields.io/badge/home%20assistant-app-blue.svg)](https://www.home-assistant.io/apps/)
[![Docker Image](https://img.shields.io/badge/docker-1.4.8-blue.svg?logo=docker&style=flat-square)](https://github.com/FaserF/hassio-addons/pkgs/container/hassio-addons-whatsapp)
![Project Maintenance](https://img.shields.io/badge/maintainer-FaserF-blue?style=flat-square)

> Home Assistant WhatsApp App (Baileys/Node.js).

---

## 📖 About

### 🗝️ Native Control Commands

Control your addon via WhatsApp!

**Public Commands:**

- `ha-app-status`: Check health and versions (HA Core/OS info included).
- `ha-app-ping`: Basic connectivity check ("Pong!").
- `ha-app-getid`: Returns the current Chat ID (useful for Group IDs).
- `ha-app-sponsor`: Show support and donation links.

**Admin Commands (Protected):**

- `ha-app-help`: Show available commands and examples.
- `ha-app-welcome`: Manually show the role-aware welcome message.
- `ha-app-diagnose`: Run full message type diagnostic (Buttons, Lists, etc.).
- `ha-app-logs`: See recent connection events.
- `ha-app-restart`: Restart the WhatsApp connection.

> [!TIP]
> **First Contact:** The bot automatically sends a welcome message to new users on their first direct message, identifying their role (Admin/Standard).

> [!TIP]
> Send `ha-app-help` from an admin number for a full list of commands and usage examples.

---

## ⚙️ Configuration

Configure the app via the **Configuration** tab in the Home Assistant App page.

### Options

```yaml
admin_notifications_enabled: true
admin_numbers: ''
keep_alive_interval: 30000
log_level: info
mark_online: false
mask_sensitive_data: false
media_folder: ''
reset_session: false
send_message_timeout: 25000
ui_auth_enabled: false
ui_auth_password: ''
webhook_enabled: false
webhook_token: ''
webhook_url: ''
welcome_message_enabled: true
```

---

## 👨‍💻 Credits & License

This project is open-source and available under the MIT License.
Maintained by **FaserF**.
