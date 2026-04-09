# Wiki.JS (Version 3 - Alpha)

<img src="https://raw.githubusercontent.com/FaserF/hassio-addons/master/wiki.js3/logo.png" width="100" alt="Logo" />

[![Open your Home Assistant instance and show the app dashboard.](https://my.home-assistant.io/badges/supervisor_addon.svg)](https://my.home-assistant.io/redirect/supervisor_addon/?addon=c1e285b7_wiki.js3)
[![Home Assistant App](https://img.shields.io/badge/home%20assistant-app-blue.svg)](https://www.home-assistant.io/apps/)
[![Docker Image](https://img.shields.io/badge/docker-0.6.1-blue.svg?logo=docker&style=flat-square)](https://github.com/FaserF/hassio-addons/pkgs/container/hassio-addons-wiki)
![Project Maintenance](https://img.shields.io/badge/maintainer-FaserF-blue?style=flat-square)

> The most powerful and extensible open source Wiki software (Version 3 - Alpha)

---

> [!CAUTION]
> **Experimental / Beta Status**
>
> This App is still in development and/or primarily developed for personal use.
> It is not extensively testet yet, but is expected to work fundamentally.

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
