# Tiny Tiny RSS

<img src="https://raw.githubusercontent.com/FaserF/hassio-addons/master/tt-rss/logo.png" width="100" />

[![Open your Home Assistant instance and show the add-on dashboard.](https://my.home-assistant.io/badges/supervisor_addon.svg)](https://my.home-assistant.io/redirect/supervisor_addon/?addon=c1e285b7_tt-rss)
[![Home Assistant App](https://img.shields.io/badge/home%20assistant-addon-blue.svg)](https://www.home-assistant.io/addons/)
[![Docker Image](https://img.shields.io/badge/docker-1.2.0-blue.svg?logo=docker&style=flat-square)](https://github.com/FaserF/hassio-addons/pkgs/container/hassio-addons-tt-rss)
![Project Maintenance](https://img.shields.io/badge/maintainer-FaserF-blue?style=flat-square)

> A web-based news feed (RSS/Atom) reader and aggregator

---

## ❤️ Support This Project

> I maintain all these add-ons in my **free time alongside a regular job**. Test devices cost money, and every donation helps me stay independent and invest more time into open-source work.
>
> Donations are completely voluntary — but the more support I receive, the less I depend on other income and the more time I can dedicate to these projects.

<div align="center">

[![GitHub Sponsors](https://img.shields.io/badge/Sponsor%20on-GitHub-%23EA4AAA?style=for-the-badge&logo=github-sponsors&logoColor=white)](https://github.com/sponsors/FaserF)&nbsp;&nbsp;
[![PayPal](https://img.shields.io/badge/Donate%20via-PayPal-%2300457C?style=for-the-badge&logo=paypal&logoColor=white)](https://paypal.me/FaserF)

</div>

---


## 📖 About

Tiny Tiny RSS is a free and open-source web-based news feed (RSS/Atom) reader and aggregator.

This app provides a self-hosted instance of Tiny Tiny RSS (TT-RSS). It is designed to be lightweight and fast, using Alpine Linux, Nginx, and PHP 8.3.

**Note:** this app requires a database. You should configure it to connect to a MariaDB or PostgreSQL instance (either another app or external).

## Installation

1. Search for "Tiny Tiny RSS" in the Home Assistant App Store.
2. Install the app.
3. Configure the database connection settings (see Configuration below).
4. Start the app.

---

## ⚙️ Configuration

Configure the add-on via the **Configuration** tab in the Home Assistant App page.

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
