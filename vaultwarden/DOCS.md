# Home Assistant Community Add-on: Vaultwarden (Bitwarden) (Custom)

## 📖 Introduction

**Vaultwarden** (formerly Bitwarden_RS) is an open-source password manager backend that is compatible with the official Bitwarden clients (Desktop, Mobile, Browser Extension). It is lightweight and perfect for self-hosting on Home Assistant.

### Architecture

This add-on runs a single container composed of:
1.  **Vaultwarden Server**: The Rust-based application handling the password manager logic.
2.  **Nginx**: A high-performance web server acting as a reverse proxy to handle SSL and potential web-socket connections (for sync).

---

## 🛠️ Installation

1.  Search for the **"Vaultwarden (Custom)"** add-on in the Supervisor add-on store.
2.  Install the add-on.
3.  Start the add-on.
4.  **Important:** Check the **Log** tab immediately after starting!
    - The add-on will generate an **Admin Token** on the first run.
    - Copy this token! You will need it to access the `/admin` interface.
5.  Click **"OPEN WEB UI"** to access your new password manager.

---

## ⚙️ Configuration

**Note**: _Remember to restart the add-on when the configuration is changed._

### Example Configuration

```yaml
log_level: info
ssl: true
certfile: fullchain.pem
keyfile: privkey.pem
request_size_limit: 10485760
```

### Option: `log_level`

Controls the verbosity of the logs.
- `info` (Default): Standard operational logs.
- `debug`: Detailed logs for troubleshooting.
- `warning`: Only show warnings and errors.

### Option: `ssl`

Enables/Disables SSL (HTTPS) for the internal Nginx server.
- `true` (Default): Nginx will serve HTTPS. Requires `certfile` and `keyfile`.
- `false`: Nginx will serve HTTP. Useful if you are behind another reverse proxy (like Nginx Proxy Manager) involving Home Assistant Ingress.

### Option: `certfile` & `keyfile`

The certificate and private key files to use for SSL.
- These files MUST be stored in your Home Assistant `/ssl/` directory.
- Example: `fullchain.pem` and `privkey.pem`.

### Option: `request_size_limit`

Limits the maximum size of a request (e.g., for file attachments).
- Default: `10485760` (10 MB).

---

## 📂 Folder Usage

The add-on uses the persistent storage to keep your data safe across restarts and updates.

- **/data**: Stores the Vaultwarden SQLite database (`db.sqlite3`), config (`config.json`), and attachments.
- **/ssl**: Read-only access to your SSL certificates.

> [!TIP]
> **Backup:** Home Assistant Snapshots automatically back up the `/data` folder. You generally don't need to do anything manually.

---

## 🌐 Network & Access

### Ingress (Recommended)
This add-on supports **Home Assistant Ingress**. You can access it securely via the Home Assistant sidebar without opening extra ports.
- **Note:** Bitwarden clients (Mobile/Desktop) might **NOT** work with Ingress URL. Ingress is best for the Web Vault management.

### Direct Access (Port 7277)
To connect your **Bitwarden Apps** (Mobile/Desktop), you usually need direct access.
1.  Map the container port `80` (or `7277`) to a host port (e.g., `7277`) in the add-on configuration "Network" section.
2.  Your Server URL will be: `https://<your-ha-ip>:7277`.
3.  **HTTPS is required** by Bitwarden clients for security. Ensure you have SSL configured!

---

## 🔧 Troubleshooting

### "Browser Context Closed" / Startup Crash
If the add-on crashes immediately, check if:
1.  Structure issue: Ensure you are using the latest version of this add-on which fixes s6 execution errors.
2.  Port conflict: Ensure port 7277 is not used by another service.

### Admin Token Lost
If you lost your admin token:
1.  Check `/addon_configs/.../vaultwarden/config.json` (or look in `/data` inside the container).
2.  Delete the token file or reset environment variable `ADMIN_TOKEN` if you set one.

---

## 🔄 Migration

If you are switching from the official add-on to this custom version:
1.  Stop the official add-on.
2.  Copy your `db.sqlite3` and `attachments` folder from the official add-on's data folder to this add-on's data folder.
3.  Start this add-on.
4.  Vaultwarden is compatible with Bitwarden database format.

---

## Support

Got questions?
- The [Home Assistant Community Add-ons Discord chat server][discord] for add-on support and feature requests.
- The [Home Assistant Discord chat server][discord-ha] for general Home Assistant discussions and questions.
- The Home Assistant [Community Forum][forum].

## Authors & contributors

The original setup of this repository is by [Franck Nijhof][frenck].
For a full list of all authors and contributors, check [the contributor's page][contributors].

## License

MIT License

Copyright (c) 2019-2026 Franck Nijhof

[contributors]: https://github.com/FaserF/hassio-addons/graphs/contributors
[discord-ha]: https://discord.gg/c5DvZ4e
[discord]: https://discord.me/hassioaddons
[forum]: https://community.home-assistant.io/t/home-assistant-community-add-on-bitwarden-rs/115573?u=frenck
[frenck]: https://github.com/frenck
