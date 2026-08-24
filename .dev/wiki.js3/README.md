# Wiki.JS (Version 3 - Alpha)

<img src="https://raw.githubusercontent.com/FaserF/hassio-addons/master/.dev/wiki.js3/logo.png" width="100" alt="Logo" />

[![Open your Home Assistant instance and show the app dashboard.](https://my.home-assistant.io/badges/supervisor_addon.svg)](https://my.home-assistant.io/redirect/supervisor_addon/?addon=605cee21_wiki.js3)
[![Home Assistant App](https://img.shields.io/badge/home%20assistant-app-blue.svg)](https://www.home-assistant.io/apps/)
[![Docker Image](https://img.shields.io/badge/docker-0.7.2-blue.svg?logo=docker&style=flat-square)](https://github.com/FaserF/hassio-addons/pkgs/container/hassio-addons-wiki)
![Project Maintenance](https://img.shields.io/badge/maintainer-FaserF-blue?style=flat-square)

> The most powerful and extensible open source Wiki software (Version 3 - Alpha)

---

> [!CAUTION]
> **In-Development Add-on**
>
> This add-on is currently in active development and excluded from the stable repository channel.
> While the Home Assistant add-on wrapper itself may be functional, the underlying upstream software is either in an early development stage or hosted within a private repository.
>
> ### 📦 How to Install
>
> **Option A: Dev Channel (In-Dev Add-ons Only — Recommended)**
> 1. Click to add the Dev repository:
>    [![Add Dev Repository](https://my.home-assistant.io/badges/supervisor_add_addon_repository.svg)](https://my.home-assistant.io/redirect/supervisor_add_addon_repository/?repository_url=https%3A%2F%2Fgithub.com%2FFaserF%2Fhassio-addons%23dev)
> 2. Or manually add repository in Home Assistant (**Settings** → **Add-ons** → **Add-on Store** → **⋮** → **Repositories**):
>    ```text
>    https://github.com/FaserF/hassio-addons#dev
>    ```
>
> **Option B: Edge Channel (All Add-ons)**
> - Repository URL: `https://github.com/FaserF/hassio-addons#edge`
>
> 💡 *After adding the repository, refresh the Add-on Store (⋮ → Check for updates) to install.*

---

## 📖 About

## 🏁 First Startup

On the first startup, you will be prompted with an administration setup wizard. The wizard will guide you through the initial configuration of your wiki connection and the creation of your administrator account.

Please create your own **Administrator Account** (Email / Password) during this process.

### Default Database Credentials

The app comes pre-configured with a local PostgreSQL database. The default password for the `wiki` database user is:

- **Password**: `wikijs` (This is the database password, NOT your admin login)

---

## ⚙️ Configuration

Configure the app via the **Configuration** tab in the Home Assistant App page.

### Options

```yaml
certfile: fullchain.pem
db_password: wikijs
keyfile: privkey.pem
log_level: info
reset_database: false
reset_database_confirm: false
ssl: true
```

---

## 👨‍💻 Credits & License

This project is open-source and available under the MIT License.
Maintained by **FaserF**.
