# Planka

![Logo](logo.png)

[![Open your Home Assistant instance and show the add-on dashboard.](https://my.home-assistant.io/badges/supervisor_addon.svg)](https://my.home-assistant.io/redirect/supervisor_addon/?addon=c1e285b7_planka)
[![Home Assistant Add-on](https://img.shields.io/badge/home%20assistant-addon-blue.svg)](https://www.home-assistant.io/addons/)
[![Docker Image](https://img.shields.io/badge/docker-1.0.0-blue.svg?logo=docker&style=flat-square)](https://github.com/FaserF/hassio-addons/pkgs/container/hassio-addons-planka)
![Project Maintenance](https://img.shields.io/badge/maintainer-FaserF-blue?style=flat-square)

> The elegant open source project tracking tool

---

## 📖 About

Planka is an elegant, open-source project tracking tool (Kanban board) that helps you organize your projects and tasks.

Planka provides a modern, collaborative way to manage tasks with features like:

- Kanban boards
- Real-time updates
- Project management
- User avatars and attachments

This add-on bundles PostgreSQL to provide a complete, self-hosted solution.

## Installation

1. Search for "Planka" in the Home Assistant Add-on Store.
2. Install the add-on.
3. Start the add-on.

---

## ⚙️ Configuration

Configure the add-on via the **Configuration** tab in the Home Assistant add-on page.

### Options

```yaml
base_url: ''
certfile: fullchain.pem
keyfile: privkey.pem
log_level: info
secret_key: ''
ssl: false
```

### First Start & Login

On first startup, the add-on will automatically create a default admin user:

**Default Credentials:**
- **Username:** `admin`
- **Email:** `admin@planka.local`
- **Password:** *Displayed in add-on logs on first start only*

> [!IMPORTANT]
> **Save the password immediately!**
> - The auto-generated password is shown **once** in the add-on logs
> - Find it in: **Settings** → **Add-ons** → **Planka** → **Log** tab
> - Look for the "PLANKA ADMIN CREDENTIALS" block
> - The password is also saved to `/addon_configs/c1e285b7_planka/planka_admin_password`

**After First Login:**
1. Log in with the default credentials
2. Go to **Settings** → **Profile**
3. Change your password immediately
4. Update your email address
5. Create additional users as needed

### Security Notes

- The default password is randomly generated (24 characters, base64-encoded)
- Change the default password after first login
- The password file is stored securely in `/addon_configs/`
- If you lose the password, you can:
  1. Check `/addon_configs/c1e285b7_planka/planka_admin_password`
  2. Or use the database reset feature (⚠️ deletes all data!)

---

## 🔄 Database Reset

The add-on supports a two-step database reset:

1. Enable `reset_database: true` in configuration
2. Enable `reset_database_confirm: true` to confirm
3. Restart the add-on

> [!CAUTION]
> This will **permanently delete ALL data** including boards, cards, users, and attachments!
> A backup is created automatically before reset.

---

## 👨‍💻 Credits & License

This project is open-source and available under the MIT License.
Maintained by **FaserF**.
