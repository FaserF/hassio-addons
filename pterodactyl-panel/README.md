# pterodactyl Panel Gameserver

<img src="https://raw.githubusercontent.com/FaserF/hassio-addons/master/pterodactyl-panel/logo.png" width="100" alt="Logo" />

[![Open your Home Assistant instance and show the app dashboard.](https://my.home-assistant.io/badges/supervisor_addon.svg)](https://my.home-assistant.io/redirect/supervisor_addon/?addon=605cee21_pterodactyl-panel)
[![Home Assistant App](https://img.shields.io/badge/home%20assistant-app-blue.svg)](https://www.home-assistant.io/apps/)
[![Docker Image](https://img.shields.io/badge/docker-1.2.1-blue.svg?logo=docker&style=flat-square)](https://github.com/FaserF/hassio-addons/pkgs/container/hassio-addons-pterodactyl_panel)
![Project Maintenance](https://img.shields.io/badge/maintainer-FaserF-blue?style=flat-square)

> Open-Source Gameserver Management Panel

---

## 📖 About

## Installation

1. Search for the "pterodactyl Panel Gameserver - BETA" app in the Home Assistant App store and install it.
2. (Optional) Set a **password** in the configuration tab. If left empty, a random password will be generated and shown in the logs.
3. Start the app.
4. For initial login credentials, please refer to the [Documentation](DOCS.md#%F0%9F%9A%80-first-login).

> [!TIP]
> **Login Information:**
>
> - **Email:** `admin@example.com`
> - **Password:** The value you set in the `password` field (or check the logs if you left it empty)
>
> > Open-Source Gameserver - Currently not fully working
>
> [!CAUTION]
> **Experimental / Beta Status**
> This app is still in development and/or primarily developed for personal use.
> It is not extensively tested yet, but is expected to work fundamentally.

If you encounter any issues with this app, please report them using the link below.
The issue form will be pre-filled with the app information to help us resolve the
problem faster.

If you have an idea for a new feature or improvement, please use the link below to
submit a feature request. The form will be pre-filled with the app information.

---

## ⚙️ Configuration

Configure the app via the **Configuration** tab in the Home Assistant App page.

### Options

```yaml
app_url: http://pterodactyl.local
certfile: fullchain.pem
keyfile: privkey.pem
log_level: info
password: ''
ssl: false
```

---

## 👨‍💻 Credits & License

This project is open-source and available under the MIT License.
Maintained by **FaserF**.
