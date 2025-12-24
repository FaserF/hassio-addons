# pterodactyl Panel Gameserver - BETA

![Logo](logo.png)

[![Open your Home Assistant instance and show the add-on dashboard.](https://my.home-assistant.io/badges/supervisor_addon.svg)](https://my.home-assistant.io/redirect/supervisor_addon/?addon=c1e285b7_pterodactyl-panel)
[![Home Assistant Add-on](https://img.shields.io/badge/home%20assistant-addon-blue.svg)](https://www.home-assistant.io/addons/)
[![GitHub Release](https://img.shields.io/github/v/release/FaserF/hassio-addons?include_prereleases&style=flat-square)](https://github.com/FaserF/hassio-addons/releases)
![Project Maintenance](https://img.shields.io/badge/maintainer-FaserF-blue?style=flat-square)

> Open-Source Gameserver - Currently not fully working

---

> [!CAUTION]
> **Experimental / Beta Status**
>
> This add-on is still in development and/or primarily developed for personal use.
> It is not extensively tested yet, but is expected to work fundamentally.

---

## 📖 About

pterodactyl Panel Gameserver for Homeassistant OS

![Ingress Support](../_images/pterodactyl/ingress.png)

> [!WARNING]
> Currently only limited working. Right now it can be considered beta and
> unstable. Don't blame me if your gameservers would be lost etc.
>
> For me I am unable to login until now. Seems to have something to do with redis,
> but I dont get what exactly.

Pterodactyl® is a free, open-source game server management panel built with PHP,
React, and Go. Designed with security in mind, Pterodactyl runs all game servers
in isolated Docker containers while exposing a beautiful and intuitive UI to end
users.
Stop settling for less. Make game servers a first-class citizen on your platform.

## Installation

The installation of this add-on is pretty straightforward and not different in
comparison to installing any other custom Home Assistant add-on.
Just click the link above or add my repo to the hassio addons repositorys:
<https://github.com/FaserF/hassio-addons>

---

## ⚙️ Configuration

Configure the add-on via the **Configuration** tab in the Home Assistant add-on page.

### Options

```yaml
certfile: fullchain.pem
keyfile: privkey.pem
password: null
ssl: true
```

---

## 👨‍💻 Credits & License

This project is open-source and available under the MIT License.
Maintained by **FaserF**.
