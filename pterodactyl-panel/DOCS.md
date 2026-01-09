# pterodactyl Panel Documentation

pterodactyl Panel Gameserver for Homeassistant OS

Pterodactyl® is a free, open-source game server management panel built with PHP, React,
and Go. Designed with security in mind, Pterodactyl runs all game servers in isolated
Docker containers while exposing a beautiful and intuitive UI to end users.

> [!WARNING]
> Currently only limited working. Right now it can be considered beta and unstable. Don't blame me if your gameservers would be lost etc.
>
> For me I am unable to login until now. Seems to have something to do with redis,
> but I dont get what exactly.

## 🚀 First Login

After the first start, you can log in with the following default credentials:

- **Email:** `admin@example.com`
- **Password:** The value you set in the **password** field of the add-on configuration.

> [!NOTE]
> If you did not set a password in the configuration, a random one was generated and printed in the add-on logs during the first startup. You can also find it in `/share/pterodactyl/.env` as `DB_PASSWORD`.

Please change the password and email address in the panel settings immediately after your first login.

## ⚙️ Configuration

Configure the add-on via the **Configuration** tab in the Home Assistant add-on page.

### Options

```yaml
certfile: fullchain.pem
keyfile: privkey.pem
log_level: info
password: ''
ssl: true
```

## 📂 Folder Usage

- `/share`: Mapped for sharing files between the panel and other add-ons or the host.
- `/ssl`: Used for SSL certificates (`certfile` and `keyfile`). Required if `ssl: true` is enabled.
- `/data`: Used for persistent storage of the panel's internal data, including the application code and local settings.

## Support

If you encounter any issues with this add-on, please report them using the link below.
The issue form will be pre-filled with the add-on information to help us resolve the
problem faster.

> Please use the link above to report problems. This ensures that all necessary
> information (add-on name, version, etc.) is automatically included in your bug report.

If you have an idea for a new feature or improvement, please use the link below to
submit a feature request. The form will be pre-filled with the add-on information.

> Please use the link above to request features. This ensures that the add-on name
> is automatically included in your feature request.
