# WhatsApp Documentation

Home Assistant WhatsApp Backend (Baileys/Node.js)

> [!WARNING]
> **Legal Disclaimer / Haftungsausschluss**
>
> This project is **not** affiliated with WhatsApp or Meta. Using automated messaging on a WhatsApp account may lead to its permanent ban. The developers assume no responsibility for any such damage.
>
> Official WhatsApp Policy: **[WhatsApp Terms of Service](https://www.whatsapp.com/legal/terms-of-service/)**

## Architecture

This add-on is a "bridge". It does **not** communicate with Home Assistant directly via the Event Bus. Instead, it acts as a server that the **WhatsApp Custom Component** connects to.

**Flow:**
`Home Assistant` -> `WhatsApp Integration` -> `HTTP (Port 8099)` -> `This Addon` -> `Baileys (Node.js)` -> `WhatsApp Web`

## 🌐 Network & Discovery

By default, this add-on uses **Isolated Network Mode** (`host_network: false`).

### Why use Host Network?
- **Auto-Discovery:** If you enable **Host Network** in the add-on's network configuration, it can broadcast its presence via **mDNS/Zeroconf** (`_ha-whatsapp._tcp.local`).
- **Ease of Use:** With Host Network enabled, Home Assistant will automatically find the add-on and prompt you to configure it ("New devices found"), pre-filling the URL and Port.

### Can I use it without Host Network?
Yes! This is the default. If you keep the isolated network:
1.  **No Auto-Discovery:** Home Assistant will not "see" the add-on automatically.
2.  **Manual Config:** You must manually enter the URL (e.g., `http://<your-ha-ip>:8066`) when setting up the integration.

## 🚀 Getting Started with Automations

Once the addon and integration are configured, check out the following resource to start building:

- **[Official Documentation & Examples](https://faserf.github.io/ha-whatsapp/)** (Buttons, Polls, Reactions, etc.)

## ⚙️ Configuration

Configure the add-on via the **Configuration** tab in the Home Assistant add-on page.

### Options

```yaml
log_level: info
send_message_timeout: 25000
keep_alive_interval: 30000
mask_sensitive_data: false
```

### Configuration Options

- `log_level`: Level of logs to output (trace, debug, info, warning, error, fatal).
- `send_message_timeout`: Time (in ms) to wait for WhatsApp acknowledgement before timing out. Increase if you have slow network.
- `keep_alive_interval`: Time (in ms) between connection checks to prevent "Stale Connection".
- `mask_sensitive_data`: If true, `+491761234567` becomes `491*****67` in logs.

> [!WARNING]
> **Privacy Trade-off:** Enabling `mask_sensitive_data` will also mask Group IDs (e.g. `123*****89@g.us`). If you are trying to find out the ID of a new group to send messages to, you MUST temporarily **disable** this option to see the full ID in the logs.

## 📂 Folder Usage

- `/data`: Used for persistent session data (`auth_info_baileys`), API tokens (`api_token.txt`), and logs. This ensure you don't have to scan the QR code frequently.
- `/config`: Home Assistant configuration directory (mapped but not used by the add-on directly).

## Troubleshooting

### "Browser Context Closed"

If you see errors about the browser context, it might have crashed. The add-on is designed to restart the browser process automatically on the next request or crash the container to let Supervisor restart it.

### Session Lost

If you lose your session, you may need to re-scan the QR code. You can trigger a new scan by reinstalling the integration or (in future versions) calling a "Logout" service.

## Support

For issues and feature requests, please use the GitHub repository issues.
