# Tiny Tiny RSS

![Logo](logo.png)

[![Open your Home Assistant instance and show the add-on dashboard.](https://my.home-assistant.io/badges/supervisor_addon.svg)](https://my.home-assistant.io/redirect/supervisor_addon/?addon=c1e285b7_tt-rss)
[![Home Assistant Add-on](https://img.shields.io/badge/home%20assistant-addon-blue.svg)](https://www.home-assistant.io/addons/)
[![Docker Image](https://img.shields.io/badge/docker-1.0.0-blue.svg?logo=docker&style=flat-square)](https://github.com/FaserF/hassio-addons/pkgs/container/hassio-addons-tt-rss)
![Project Maintenance](https://img.shields.io/badge/maintainer-FaserF-blue?style=flat-square)

> A web-based news feed (RSS/Atom) reader and aggregator

---

## 📖 About

Tiny Tiny RSS is a free and open-source web-based news feed (RSS/Atom) reader and aggregator.

This add-on provides a self-hosted instance of Tiny Tiny RSS (TT-RSS). It is designed to be lightweight and fast, using Alpine Linux, Nginx, and PHP 8.3.

**Note:** This add-on requires a database. You should configure it to connect to a MariaDB or PostgreSQL instance (either another add-on or external).

## Installation

1. Search for "Tiny Tiny RSS" in the Home Assistant Add-on Store.
2. Install the add-on.
3. Configure the database connection settings (see Configuration below).
4. Start the add-on.

---

## ⚙️ Configuration

Configure the add-on via the **Configuration** tab in the Home Assistant add-on page.

### Options

```yaml
certfile: fullchain.pem
keyfile: privkey.pem
log_level: info
self_url: ''
ssl: false
```

---

## 👨‍💻 Credits & License

This project is open-source and available under the MIT License.
Maintained by **FaserF**.
