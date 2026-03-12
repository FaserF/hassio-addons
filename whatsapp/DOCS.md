# WhatsApp Documentation

> [!TIP]
> **Rocket.Chat & Webhook Support**: Did you know? You can bridge WhatsApp to **Rocket.Chat** or use **Webhooks** for custom integrations. See the **[Rocket.Chat Guide](https://faserf.github.io/ha-whatsapp/rocketchat.html)** and **[Webhook Guide](https://faserf.github.io/ha-whatsapp/webhooks.html)** for more.

---

Home Assistant WhatsApp Backend (Baileys/Node.js)

> [!WARNING]
> **Legal Disclaimer / Haftungsausschluss**
>
> This project is **not** affiliated with WhatsApp or Meta. Using automated messaging on a WhatsApp account may lead to its permanent ban. The developers assume no responsibility for any such damage.
>
> Official WhatsApp Policy: **[WhatsApp Terms of Service](https://www.whatsapp.com/legal/terms-of-service/)**

## Architecture

This app is a "bridge". It does **not** communicate with Home Assistant directly via the Event Bus. Instead, it acts as a server that the **WhatsApp Custom Component** connects to.

**Flow:**
`Home Assistant` -> `WhatsApp Integration` -> `HTTP (Port 8099)` -> `This App` -> `Baileys (Node.js)` -> `WhatsApp Web`

## 🔒 Security & Public Access

Requires Home Assistant 2024.12+ (or newer) to expose ports via the App configuration.

If you plan to use **Webhooks** or the **Rocket.Chat integration**, you may need to expose **Port 8066** to the internet (or at least to your Rocket.Chat instance).

> [!CAUTION]
> **Risk of Unauthorized Access**
> Exposing Port 8066 publicly makes the Web UI (containing your API Token and Logs) accessible to anyone.
>
> You **MUST** enable **UI Authentication** if you expose this port!

To enable password protection for the Web UI:

1. Set `ui_auth_enabled` to `true`.
2. Set a strong password in `ui_auth_password`.
3. When accessing the Web UI, use username: `admin` and your chosen password.

## 🚀 Getting Started with Automations

Once the App and integration are configured, check out the following resources to start building:

- [Installation](https://faserf.github.io/ha-whatsapp/installation.html)
- [Automations](https://faserf.github.io/ha-whatsapp/automations.html)
- [Rocket.Chat Integration](https://faserf.github.io/ha-whatsapp/rocketchat.html)
- [API Reference](https://faserf.github.io/ha-whatsapp/SERVICES.html)

## ⚙️ Configuration

Configure the app via the **Configuration** tab in the Home Assistant app page.

### Options

```yaml
log_level: info
send_message_timeout: 25000
keep_alive_interval: 30000
mask_sensitive_data: false
ui_auth_enabled: false
ui_auth_password: ''
media_folder: null
admin_numbers: ''
welcome_message_enabled: true
admin_notifications_enabled: true
```

### Configuration Options

- `log_level`: Level of logs to output (trace, debug, info, warning, error, fatal).
- `send_message_timeout`: Time (in ms) to wait for WhatsApp acknowledgement before timing out. Increase if you have slow network.
- `keep_alive_interval`: Time (in ms) between connection checks to prevent "Stale Connection".
- `mask_sensitive_data`: If true, `+491761234567` becomes `491*****67` in logs.
- `ui_auth_enabled`: Enables Basic Authentication for the Web UI (not the API).
- `ui_auth_password`: The password for the Web UI (Username is always `admin`).
- `admin_numbers`: Comma-separated list of phone numbers (e.g. `49176123456, 49176987654`) that are allowed to use `ha-app-*` admin commands.
- `welcome_message_enabled`: (Default: `true`) If true, the bot sends a role-aware welcome message on first-contact from a new user.
- `admin_notifications_enabled`: (Default: `true`) Automatically notifies admins about system health (WhatsApp loss/restore, HA Core/Integration updates, HA restarts).
- `mark_online`: (Default: `false`) If set to `true`, the app will mark your account as "Online" as long as it's running. Using `false` is recommended to avoid silencing notifications on your mobile phone.
- `media_folder`: (for example: `/media/whatsapp`) Path to a folder where received media (Images, Videos, Voice) should be saved. If set, files will **NOT** be automatically deleted. If cleared (`null` in the YAML config), files are stored internally and deleted after 24h.

> [!CAUTION]
> **Privacy Consideration for `media_folder`**
> When a custom `media_folder` is set, all files in that directory are served publicly via the `/media` endpoint (e.g., `http://<host-ip>:8066/media/filename`).
>
> If you point this to a shared directory (like `/media/whatsapp`), ensure that no sensitive or private files are stored there, as they will be accessible without authentication if the port is exposed.

> [!WARNING]
> **Privacy Trade-off:** Enabling `mask_sensitive_data` will also mask Group IDs (e.g. `123*****89@g.us`). If you are trying to find out the ID of a new group to send messages to, you MUST temporarily **disable** this option to see the full ID in the logs.

## 📂 Folder Usage

- `/data`: Used for persistent session data (`auth_info_baileys`), API tokens (`api_token.txt`), and logs. This ensure you don't have to scan the QR code frequently.
- `/config`: Home Assistant configuration directory (mapped but not used by the app directly).

## Troubleshooting

### "Browser Context Closed"

If you see errors about the browser context, it might have crashed. The app is designed to restart the browser process automatically on the next request or crash the container to let Supervisor restart it.

### Session Lost

If you lose your session, you may need to re-scan the QR code. You can trigger a new scan by reinstalling the integration or (in future versions) calling a "Logout" service.

## Support

For issues and feature requests, please use the GitHub repository issues.

---

## 🎣 Webhook Support

You can configure this app to forward all incoming messages to a webhook URL. This is useful for custom integrations, logging, or bridging to other chat systems.

**Configuration:**

- `webhook_enabled`: Set to `true`
- `webhook_url`: The full URL to POST data to (e.g., `https://my-webhook.com/whatsapp`)
- `webhook_token`: (Optional) A secret token sent in the `X-Webhook-Token` header.

**Payload Format:**
The webhook will receive a JSON payload for every incoming message. See [Webhook Guide](https://faserf.github.io/ha-whatsapp/webhooks.html) for details.

## 🚀 Rocket.Chat Support

This app can be used as a bridge for Rocket.Chat using the **Rocket.Chat Apps** framework.

**Setup:**

1. Install the Rocket.Chat App (Apps > Marketplace > Private App).
2. Configure the App settings in Rocket.Chat with your App URL and API Token.
3. Enable Webhooks in this App and point them to your Rocket.Chat instance.

See the full **[Rocket.Chat Integration Guide](https://faserf.github.io/ha-whatsapp/rocketchat.html)** for step-by-step instructions.

---

## 🔔 Admin Status Notifications

If `admin_notifications_enabled` is set to `true`, all configured **Admins** will receive automatic WhatsApp alerts for critical system events:

- **WhatsApp Connection**: Notifies when the bot loses or restores its connection to WhatsApp (includes downtime duration).
- **Home Assistant Core**: Notifies when Home Assistant becomes unreachable or comes back online (e.g., during a restart or update).
- **Update Detection**:
  - **Addon/Integration**: Alerts when you've updated the WhatsApp App or the HA Integration.
  - **HA Core**: Automatically detects if a Core update was successful and reports the version change (e.g., `2024.2.1 ➔ 2024.3.0`).

## 👋 Welcome Message (First Contact)

The bot can automatically greet new users who send a direct message for the first time.

- **Role Awareness**: The message identifies if the user is an **Admin** or a **Standard User**.
- **Admin Tips**: Provides quick tips for administrators (`ha-app-status` and `ha-app-help`).
- **Support Links**: Includes a link to the project documentation.
- **Manual Trigger**: Use `ha-app-welcome` (Admin only) to manually trigger the message.
