# Planka

> [!CAUTION]
> **EDGE/DEVELOPMENT BUILD**
>
> You are viewing the `edge` branch. This version is built locally from source
> and may contain bugs or incomplete features. For stable releases, switch to
> the `master` branch or use the stable repository URL.



<img src="https://raw.githubusercontent.com/FaserF/hassio-addons/master/planka/logo.png" width="100" />

[![Open your Home Assistant instance and show the add-on dashboard.](https://my.home-assistant.io/badges/supervisor_addon.svg)](https://my.home-assistant.io/redirect/supervisor_addon/?addon=c1e285b7_planka)
[![Home Assistant App](https://img.shields.io/badge/home%20assistant-addon-blue.svg)](https://www.home-assistant.io/addons/)
[![Docker Image](https://img.shields.io/badge/docker-1.2.0-blue.svg?logo=docker&style=flat-square)](https://github.com/FaserF/hassio-addons/pkgs/container/hassio-addons-planka)
![Project Maintenance](https://img.shields.io/badge/maintainer-FaserF-blue?style=flat-square)

> The elegant open source project tracking tool

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

Planka is an elegant, open-source project tracking tool (Kanban board) that helps you organize your projects and tasks.

Planka provides a modern, collaborative way to manage tasks with features like:

- Kanban boards
- Real-time updates
- Project management
- User avatars and attachments

This app bundles PostgreSQL to provide a complete, self-hosted solution.

## Installation

1. Search for "Planka" in the Home Assistant App Store.
2. Install the app.
3. Start the app.

---

## ⚙️ Configuration

Configure the add-on via the **Configuration** tab in the Home Assistant App page.

### Options

```yaml
base_url: ''
certfile: fullchain.pem
keyfile: privkey.pem
log_level: info
secret_key: ''
ssl: false
```

---

## 👨‍💻 Credits & License

This project is open-source and available under the MIT License.
Maintained by **FaserF**.
