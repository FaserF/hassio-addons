# WhatsApp Home Assistant App

<img src="https://raw.githubusercontent.com/FaserF/hassio-addons/master/whatsapp/logo.png" width="100" alt="Logo" />

[![Open your Home Assistant instance and show the app dashboard.](https://my.home-assistant.io/badges/supervisor_addon.svg)](https://my.home-assistant.io/redirect/supervisor_addon/?addon=605cee21_whatsapp)
[![Home Assistant App](https://img.shields.io/badge/home%20assistant-app-blue.svg)](https://www.home-assistant.io/apps/)
[![Docker Image](https://img.shields.io/badge/docker-1.6.3-blue.svg?logo=docker&style=flat-square)](https://github.com/FaserF/hassio-addons/pkgs/container/hassio-addons-whatsapp)
![Project Maintenance](https://img.shields.io/badge/maintainer-FaserF-blue?style=flat-square)

> Home Assistant WhatsApp App (Baileys/Node.js).

---

## 📖 About

This Home Assistant App runs the WhatsApp Gateway backend (using Baileys/Node.js).

> [!NOTE]
> **Standalone Deployments**: If you run Home Assistant without Supervisor (e.g. Home Assistant Container in Docker), you can deploy this backend standalone. See the [WhatsappGateway repository](https://github.com/FaserF/WhatsappGateway) for Docker Compose and standalone usage details.

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

## ⚠️ Anti-Ban & Safety Guidelines

Since this addon uses an unofficial WhatsApp API library (Baileys), WhatsApp's automated anti-spam systems may flag and temporarily/permanently suspend accounts that show spam-like behavior. Follow these rules to keep your account safe:

- **Warm Up New Numbers**: Do not use brand new SIM cards or freshly registered numbers for the bot. Use a number that has an existing manually-established chat history with real users.
- **Save Contacts**: Ensure the accounts receiving messages have the bot's phone number saved in their contact lists. Sending messages to unsaved contacts significantly increases the risk of being flagged.
- **Avoid Bulk Messaging**: Do not send messages to a large number of recipients or groups simultaneously.
- **Use Delays**: When sending consecutive messages via Home Assistant automations, always insert delay actions (e.g. 5–10 seconds) between messages.
- **Simulate Typing**: The addon automatically simulates typing presence (`composing...`) for 1–2.5s before every message to emulate human behavior.

---

## ⚙️ Configuration

Configure the app via the **Configuration** tab in the Home Assistant App page.

### Options

```yaml
admin_notifications_enabled: true
admin_numbers: ''
group_fetch_cooldown_on_error: 60000
group_fetch_cooldown_on_rate_limit: 900000
group_fetch_interval: 300000
keep_alive_interval: 30000
log_level: info
mark_online: false
mask_sensitive_data: false
media_folder: ''
message_send_interval: 1000
reject_unauthorized: true
reset_session: false
send_message_timeout: 25000
ui_auth_enabled: false
ui_auth_password: ''
webhook_enabled: false
webhook_token: ''
webhook_url: ''
welcome_message_enabled: false
```

---

## 👨‍💻 Credits & License

This project is open-source and available under the MIT License.
Maintained by **FaserF**.
