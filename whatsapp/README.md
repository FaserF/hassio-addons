# WhatsApp

<img src="https://raw.githubusercontent.com/FaserF/hassio-addons/master/whatsapp/logo.png" width="100" />

[![Open your Home Assistant instance and show the add-on dashboard.](https://my.home-assistant.io/badges/supervisor_addon.svg)](https://my.home-assistant.io/redirect/supervisor_addon/?addon=c1e285b7_whatsapp)
[![Home Assistant App](https://img.shields.io/badge/home%20assistant-addon-blue.svg)](https://www.home-assistant.io/addons/)
[![Docker Image](https://img.shields.io/badge/docker-1.4.3-blue.svg?logo=docker&style=flat-square)](https://github.com/FaserF/hassio-addons/pkgs/container/hassio-addons-whatsapp)
![Project Maintenance](https://img.shields.io/badge/maintainer-FaserF-blue?style=flat-square)

> Home Assistant WhatsApp App (Baileys/Node.js).

---

## 📖 About

<a href="https://github.com/FaserF/ha-whatsapp">
</a>

<a href="https://my.home-assistant.io/redirect/supervisor_addon/?addon=c1e285b7_whatsapp" target="_blank">
</a>

## ❤️ Support This Project

> I maintain this integration in my **free time alongside my regular job** — bug hunting, new features, and testing on real hardware. Test devices cost money, and every donation helps me stay independent and free up more time for open-source work.
>
> Donations are completely voluntary — but the more support I receive, the less I depend on other income sources and the more time I can realistically invest into these GitHub projects. 💪

<div align="center">

</div>

## 🐛 Report a Bug

If you encounter any issues with this app, please report them using the link below. The issue form will be pre-filled with the app information to help us resolve the problem faster.

**[Report a Bug](https://github.com/FaserF/hassio-addons/issues/new?template=bug_report.yml&version_integration=0.3.0&log_information=Please+paste+the+App+log+output+here%3A%0A%0A)**

## 💡 Feature Request

If you have an idea for a new feature or improvement, please use the link below to submit a feature request. The form will be pre-filled with the app information.

**[Request a Feature](https://github.com/FaserF/hassio-addons/issues/new?template=feature_request.yml&App_name=whatsapp)**

> [!NOTE]
> Please use the link above to request features. This ensures that the app name is automatically included in your feature request.

## 🛠️ Usage & Integration

To actually send messages and automate WhatsApp, you need the **WhatsApp Custom Integration** for Home Assistant.

- **[Official Documentation & Examples](https://faserf.github.io/ha-whatsapp/)**: Comprehensive guide on how to use the `notify` service, send buttons, polls, images, and creating bot automations.

> [!WARNING]
> **Interactive Messages (Buttons & Lists)**: These features are increasingly restricted by Meta for unofficial APIs. They may not appear on all devices (especially iOS). If they fail for you, consider using standard text messages or **Polls**, which are much more reliable.

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

Configure the add-on via the **Configuration** tab in the Home Assistant App page.

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
