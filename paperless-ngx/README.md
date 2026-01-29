# Paperless-ngx

<img src="https://raw.githubusercontent.com/FaserF/hassio-addons/master/paperless-ngx/logo.png" width="100" />

[![Open your Home Assistant instance and show the add-on dashboard.](https://my.home-assistant.io/badges/supervisor_addon.svg)](https://my.home-assistant.io/redirect/supervisor_addon/?addon=c1e285b7_paperless-ngx)
[![Home Assistant Add-on](https://img.shields.io/badge/home%20assistant-addon-blue.svg)](https://www.home-assistant.io/common-tasks/os/#installing-and-configuring-add-ons)
[![Docker Image](https://img.shields.io/badge/docker-0.1.0-blue.svg?logo=docker&style=flat-square)](https://github.com/FaserF/hassio-addons/pkgs/container/hassio-addons-paperless-ngx)
![Project Maintenance](https://img.shields.io/badge/maintainer-FaserF-blue?style=flat-square)

> Community-supported Paperless-ngx Add-on for Home Assistant

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

This add-on brings Paperless-ngx to Home Assistant OS, fully integrated with Ingress and running on a lightweight Alpine Linux base.

## Features

- **Ingress Support**: Access Paperless directly from your Home Assistant dashboard.
- **Renovate Monitoring**: Kept up-to-date automatically.
- **OCR Support**: Built-in OCR for German and English (configurable).
- **Architecture**: Supports aarch64, amd64, and armv7.

## Installation

1. Add this repository to your Home Assistant Add-on Store.
2. Install the **Paperless-ngx** add-on.
3. Configure your preferences in the `Configuration` tab (Time Zone, OCR Language, Admin User).
4. Start the add-on.

---

## ⚙️ Configuration

Configure the add-on via the **Configuration** tab in the Home Assistant add-on page.

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
