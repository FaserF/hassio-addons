# Apache2 Minimal

<img src="https://raw.githubusercontent.com/FaserF/hassio-addons/master/apache2-minimal/logo.png" width="100" alt="Logo" />

[![Open your Home Assistant instance and show the app dashboard.](https://my.home-assistant.io/badges/supervisor_addon.svg)](https://my.home-assistant.io/redirect/supervisor_addon/?addon=c1e285b7_apache2-minimal)
[![Home Assistant App](https://img.shields.io/badge/home%20assistant-app-blue.svg)](https://www.home-assistant.io/apps/)
[![Docker Image](https://img.shields.io/badge/docker-3.3.0-blue.svg?logo=docker&style=flat-square)](https://github.com/FaserF/hassio-addons/pkgs/container/hassio-addons-apache2-minimal)
![Project Maintenance](https://img.shields.io/badge/maintainer-FaserF-blue?style=flat-square)

> Open Source Webserver without PHP and minimal extra modules.

---

## 📖 About

A lightweight, security-focused version of the Apache HTTP Server. This addon provides a bare-bones web server optimized for static content and performance. It excludes PHP and extra modules to minimize the footprint and attack surface, making it perfect for simple HTML sites, documentation, or serving assets.

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

For more information and configuration details, please refer to the [Integration README](../custom_components/webserver_app/README.md).

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
ssl: true
website_name: web.local
```

---

## 👨‍💻 Credits & License

This project is open-source and available under the MIT License.
Maintained by **FaserF**.
