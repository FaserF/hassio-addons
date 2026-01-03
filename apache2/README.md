# Apache2

<img src="logo.png" alt="Logo" width="200">

[![Open your Home Assistant instance and show the add-on dashboard.](https://my.home-assistant.io/badges/supervisor_addon.svg)](https://my.home-assistant.io/redirect/supervisor_addon/?addon=c1e285b7_apache2)
[![Home Assistant Add-on](https://img.shields.io/badge/home%20assistant-addon-blue.svg)](https://www.home-assistant.io/addons/)
[![GitHub Release](https://img.shields.io/github/v/release/FaserF/hassio-addons?include_prereleases&style=flat-square)](https://github.com/FaserF/hassio-addons/releases)
![Project Maintenance](https://img.shields.io/badge/maintainer-FaserF-blue?style=flat-square)

> Open Source Webserver with PHP and MariaDB.

---

## 📖 About

A lightweight Apache 2 web server for Home Assistant OS, with optional PHP 8 and MariaDB support.

## 🧰 Versions

| Version                                  | Features                                                                     |
| :--------------------------------------- | :--------------------------------------------------------------------------- |
| [Full][full_url]                         | Apache2, PHP 8.4 (with common extensions), MariaDB client, ffmpeg, Mosquitto |
| [Minimal][minimal_url]                   | Apache2 only                                                                 |
| [Minimal + MariaDB][minimal_mariadb_url] | Apache2, MariaDB client, PHP with basic modules                              |

[full_url]: https://github.com/FaserF/hassio-addons/tree/master/apache2
[minimal_url]: https://github.com/FaserF/hassio-addons/tree/master/apache2-minimal
[minimal_mariadb_url]: https://github.com/FaserF/hassio-addons/tree/master/apache2-minimal-mariadb

## 🚀 Installation

1. Add the repository to Home Assistant.
2. Install the `Apache2` add-on via Supervisor.
3. Place your website files in `document_root` (Default: `/share/htdocs`).
4. Start the add-on.

## 📝 Documentation

For detailed information, configuration, and folder usage, please refer to the **[Documentation](DOCS.md)** (also available via the **Documentation** tab in the Home Assistant interface).

---

## 👨‍💻 Credits & License

This project is open-source and available under the MIT License.
Maintained by **FaserF**.
