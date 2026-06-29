# Apache2

<img src="https://raw.githubusercontent.com/FaserF/hassio-addons/master/apache2/logo.png" width="100" alt="Logo" />

[![Open your Home Assistant instance and show the app dashboard.](https://my.home-assistant.io/badges/supervisor_addon.svg)](https://my.home-assistant.io/redirect/supervisor_addon/?addon=605cee21_apache2)
[![Home Assistant App](https://img.shields.io/badge/home%20assistant-app-blue.svg)](https://www.home-assistant.io/apps/)
[![Docker Image](https://img.shields.io/badge/docker-3.4.2-blue.svg?logo=docker&style=flat-square)](https://github.com/FaserF/hassio-addons/pkgs/container/hassio-addons-apache2)
![Project Maintenance](https://img.shields.io/badge/maintainer-FaserF-blue?style=flat-square)

> Open Source Webserver with PHP and MariaDB.

---

## 📖 About

Apache HTTP Server is a powerful, flexible, and robust open-source web-server. This addon provides a pre-configured Apache2 environment with full PHP support and MariaDB client integration. It includes `mod_rewrite` enabled by default for `.htaccess` routing support.

### Apache2 Variant Comparison

| Feature | Apache2 (Full) | Apache2 Minimal | Apache2 Minimal + MariaDB |
| :--- | :--- | :--- | :--- |
| **PHP Support** | ✅ Yes (Full) | ❌ No | ✅ Yes (Basic) |
| **MariaDB Client** | ✅ Yes | ❌ No | ✅ Yes |
| **Footprint** | 🖥️ Large | ⚡ Smallest | ⚖️ Medium |
| **Best For** | WordPress, Full CMS | Static Sites | Simple PHP Apps |

---

## 🏠 Home Assistant Integration

This addon supports the **Webserver App** integration for Home Assistant. 
The integration is automatically installed/updated when the addon starts.

For more information and configuration details, please refer to the [Integration README](https://github.com/FaserF/ha-webserver).

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

> [!NOTE]
> **URL Rewriting**: `mod_rewrite` is loaded by default. You can use standard `.htaccess` files for routing and redirections.
>
> **SSL/TLS & Local IP Warnings**: If `ssl` is `true`, accessing the site using a local IP address (e.g., `https://192.168.1.50:8324`) will trigger certificate warnings since SSL certs are issued to domain names. If you only want to access your sites locally without warnings, set `ssl: false` and access via HTTP on port `80`.

---

## 👨‍💻 Credits & License

This project is open-source and available under the MIT License.
Maintained by **FaserF**.
