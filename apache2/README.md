# Apache2

<img src="https://raw.githubusercontent.com/FaserF/hassio-addons/master/apache2/logo.png" width="100" alt="Logo" />

[![Open your Home Assistant instance and show the app dashboard.](https://my.home-assistant.io/badges/supervisor_addon.svg)](https://my.home-assistant.io/redirect/supervisor_addon/?addon=c1e285b7_apache2)
[![Home Assistant App](https://img.shields.io/badge/home%20assistant-app-blue.svg)](https://www.home-assistant.io/apps/)
[![Docker Image](https://img.shields.io/badge/docker-3.3.0-blue.svg?logo=docker&style=flat-square)](https://github.com/FaserF/hassio-addons/pkgs/container/hassio-addons-apache2)
![Project Maintenance](https://img.shields.io/badge/maintainer-FaserF-blue?style=flat-square)

> Open Source Webserver with PHP and MariaDB.

---

## 📖 About

## 🧰 Versions

| Version                                  | Features                                                                     |
| :--------------------------------------- | :--------------------------------------------------------------------------- |
| [Full][full_url]                         | Apache2, PHP 8.4 (with common extensions), MariaDB client, ffmpeg, Mosquitto |
| [Minimal][minimal_url]                   | Apache2 only                                                                 |
| [Minimal + MariaDB][minimal_mariadb_url] | Apache2, MariaDB client, PHP with basic modules                              |

[full_url]: https://github.com/FaserF/hassio-addons/tree/master/apache2
[minimal_url]: https://github.com/FaserF/hassio-addons/tree/master/apache2-minimal
[minimal_mariadb_url]: https://github.com/FaserF/hassio-addons/tree/master/apache2-minimal-mariadb

---

## ⚙️ Configuration

Configure the app via the **Configuration** tab in the Home Assistant App page.

### Options

```yaml
certfile: fullchain.pem
default_conf: default
default_ssl_conf: default
document_root: /share/htdocs
init_commands: []
keyfile: privkey.pem
log_level: info
php_ini: default
ssl: true
website_name: web.local
```

---

## 👨‍💻 Credits & License

This project is open-source and available under the MIT License.
Maintained by **FaserF**.
