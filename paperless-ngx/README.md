# Paperless-ngx

> [!CAUTION]
> **EDGE/DEVELOPMENT BUILD**
>
> You are viewing the `edge` branch. This version is built locally from source
> and may contain bugs or incomplete features. For stable releases, switch to
> the `master` branch or use the stable repository URL.



<img src="https://raw.githubusercontent.com/FaserF/hassio-addons/master/paperless-ngx/logo.png" width="100" />

[![Open your Home Assistant instance and show the add-on dashboard.](https://my.home-assistant.io/badges/supervisor_addon.svg)](https://my.home-assistant.io/redirect/supervisor_addon/?addon=c1e285b7_paperless-ngx)
[![Home Assistant App](https://img.shields.io/badge/home%20assistant-addon-blue.svg)](https://www.home-assistant.io/addons/)
[![Docker Image](https://img.shields.io/badge/docker-0.1.0-blue.svg?logo=docker&style=flat-square)](https://github.com/FaserF/hassio-addons/pkgs/container/hassio-addons-paperless-ngx)
![Project Maintenance](https://img.shields.io/badge/maintainer-FaserF-blue?style=flat-square)

> Community-supported Paperless-ngx App for Home Assistant

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


> [!CAUTION]
> **Experimental / Beta Status**
>
> This add-on is still in development and/or primarily developed for personal use.
> It is not extensively tested yet, but is expected to work fundamentally.

---

## 📖 About

Scan, index, and archive all of your physical documents.

[Paperless-ngx][paperless-ngx] is a community-supported open-source document management system that transforms your physical documents into a searchable online archive so you can keep less paper.

This app brings Paperless-ngx to Home Assistant OS, fully integrated with Ingress and running on a lightweight Alpine Linux base.

## Features

- **Ingress Support**: Access Paperless directly from your Home Assistant dashboard.
- **Renovate Monitoring**: Kept up-to-date automatically.
- **OCR Support**: Built-in OCR for German and English (configurable).
- **Architecture**: Supports aarch64, amd64, and armv7.

## Installation

1. Add this repository to your Home Assistant App Store.
2. Install the **Paperless-ngx** app.
3. Configure your preferences in the `Configuration` tab (Time Zone, OCR Language, Admin User).
4. Start the app.

---

## ⚙️ Configuration

Configure the add-on via the **Configuration** tab in the Home Assistant App page.

### Options

```yaml
admin_password: ''
admin_user: admin
filename_format: '{created_year}/{correspondent}/{title}'
log_level: info
ocr_language: deu
reset_database: false
reset_database_confirm: false
secret_key: changeme
time_zone: Europe/Berlin
url: null
```

---

## 👨‍💻 Credits & License

This project is open-source and available under the MIT License.
Maintained by **FaserF**.
