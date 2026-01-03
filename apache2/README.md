# Apache2

![Logo](logo.png)

[![Open your Home Assistant instance and show the add-on dashboard.](https://my.home-assistant.io/badges/supervisor_addon.svg)](https://my.home-assistant.io/redirect/supervisor_addon/?addon=c1e285b7_apache2)
[![Home Assistant Add-on](https://img.shields.io/badge/home%20assistant-addon-blue.svg)](https://www.home-assistant.io/addons/)
[![GitHub Release](https://img.shields.io/github/v/release/FaserF/hassio-addons?include_prereleases&style=flat-square)](https://github.com/FaserF/hassio-addons/releases)
![Project Maintenance](https://img.shields.io/badge/maintainer-FaserF-blue?style=flat-square)

> Open Source Webserver with PHP and MariaDB.

---

> [!CAUTION]
> **Experimental / Beta Status**
>
> This add-on is still in development and/or primarily developed for personal use.
> It is not extensively tested yet, but is expected to work fundamentally.

---

## 📖 About

![Ingress Support](../_images/apache2/ingress.png)

A lightweight Apache 2 web server for Home Assistant OS, with optional
PHP 8 and MariaDB support.

This add-on allows you to serve static or dynamic websites, run PHP-based
applications, or expose internal services via a web interface. Multiple
versions are available to fit different needs and use cases.

## 📋 Table of Contents

- [About](#-about)
- [Versions](#-versions)
- [Installation](#-installation)
- [Configuration](#️-configuration)
- [Credits & License](#-credits--license)

This add-on provides the [Apache HTTP Server](https://httpd.apache.org/) for
Home Assistant OS. It supports:

- Hosting static HTML/CSS/JS websites
- Running PHP applications (e.g. dashboards, tools)
- Optional MariaDB integration (e.g. for WordPress, phpMyAdmin)

The Apache HTTP Server is an open-source web server software maintained by the
Apache Software Foundation.

## 🧰 Versions

<!-- markdownlint-disable MD013 -->

| Version                                  | Features                                                                     |
| :--------------------------------------- | :--------------------------------------------------------------------------- |
| [Full][full_url]                         | Apache2, PHP 8.4 (with common extensions), MariaDB client, ffmpeg, Mosquitto |
| [Minimal][minimal_url]                   | Apache2 only                                                                 |
| [Minimal + MariaDB][minimal_mariadb_url] | Apache2, MariaDB client, PHP with basic modules                              |

[full_url]: https://github.com/FaserF/hassio-addons/tree/master/apache2
[minimal_url]: https://github.com/FaserF/hassio-addons/tree/master/apache2-minimal
[minimal_mariadb_url]: https://github.com/FaserF/hassio-addons/tree/master/apache2-minimal-mariadb

## 🚀 Installation

1. Add the repository to Home Assistant:

1. Install the `Apache2` add-on via Supervisor.

1. Place your website files in document_root (Default: `/share/htdocs`).
   Example: `/share/htdocs/index.html`

1. Start the add-on and access your site via Ingress or external port.

---

## ⚙️ Configuration

Configure the add-on via the **Configuration** tab in the Home Assistant add-on page.

### Options

```yaml
certfile: fullchain.pem
default_conf: default
default_ssl_conf: default
document_root: /share/htdocs
init_commands: []
keyfile: privkey.pem
php_ini: default
ssl: true
website_name: null
```

---

## 👨‍💻 Credits & License

This project is open-source and available under the MIT License.
Maintained by **FaserF**.
