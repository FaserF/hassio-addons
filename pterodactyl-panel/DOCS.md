# pterodactyl Panel Documentation

pterodactyl Panel Gameserver for Homeassistant OS

Pterodactyl® is a free, open-source game server management panel built with PHP, React,
and Go. Designed with security in mind, Pterodactyl runs all game servers in isolated
Docker containers while exposing a beautiful and intuitive UI to end users.

> [!WARNING]
> Currently only limited working. Right now it can be considered beta and unstable. Don't blame me if your gameservers would be lost etc.
> For me I am unable to login until now. Seems to have something to do with redis,
> but I dont get what exactly.

## 🚀 First Login

After the first start, you can log in with the following default credentials:

- **Email:** `admin@example.com`
- **Password:** The value you set in the **password** field of the app configuration.

> [!IMPORTANT]
> **How to get your password:**
>
> 1. **If you set a password in the configuration:**
>    - Use the exact password you entered in the `password` field of the app configuration.
> 2. **If you left the password field empty:**
>    - A random password was automatically generated during the first startup.
>    - Check the app logs for a message like: `"No database password set in configuration! Generating random password: XXXXXXXXXX"`
>    - You can also find it in `/share/pterodactyl/.env` as `DB_PASSWORD=`
>    - Or check the startup logs for: `"For the first login use admin@example.com / admin as user and your database password to sign in."`
>
> [!NOTE]
> The `password` field in the configuration serves **two purposes**:
>
> - It's used as the database password for the `pterodactyl` database user
> - It's also used as the initial admin login password for the panel
>
> If you don't set a password, a random one is generated and shown in the logs. **Make sure to save it!**

Please change the password and email address in the panel settings immediately after your first login.

## ⚙️ Configuration

Configure the app via the **Configuration** tab in the Home Assistant App page.

### Options

```yaml
certfile: fullchain.pem
keyfile: privkey.pem
log_level: info
password: ''
ssl: true
```

## 📂 Folder Usage

- `/share`: Mapped for sharing files between the panel and other apps or the host.
- `/ssl`: Used for SSL certificates (`certfile` and `keyfile`). Required if `ssl: true` is enabled.
- `/data`: Used for persistent storage of the panel's internal data, including the application code and local settings.

## Support

If you encounter any issues with this app, please report them using the link below.
The issue form will be pre-filled with the app information to help us resolve the
problem faster.

> Please use the link above to report problems. This ensures that all necessary
> information (app name, version, etc.) is automatically included in your bug report.

If you have an idea for a new feature or improvement, please use the link below to
submit a feature request. The form will be pre-filled with the app information.

> Please use the link above to request features. This ensures that the app name
> is automatically included in your feature request.
