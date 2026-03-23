# Apache2 Minimal

<img src="https://raw.githubusercontent.com/FaserF/hassio-addons/master/apache2-minimal/logo.png" width="100" alt="Logo" />

[![Open your Home Assistant instance and show the app dashboard.](https://my.home-assistant.io/badges/supervisor_addon.svg)](https://my.home-assistant.io/redirect/supervisor_addon/?addon=c1e285b7_apache2-minimal)
[![Home Assistant App](https://img.shields.io/badge/home%20assistant-app-blue.svg)](https://www.home-assistant.io/apps/)
[![Docker Image](https://img.shields.io/badge/docker-3.3.0-blue.svg?logo=docker&style=flat-square)](https://github.com/FaserF/hassio-addons/pkgs/container/hassio-addons-apache2-minimal)
![Project Maintenance](https://img.shields.io/badge/maintainer-FaserF-blue?style=flat-square)

> Open Source Webserver without PHP and minimal extra modules.

## 📚 Documentation

For complete documentation, configuration options, and detailed information, please refer to the **[Full Apache2 App Documentation](https://github.com/FaserF/hassio-addons/tree/master/apache2)**.

This minimal variant shares the same core functionality and configuration options as the full version, but with reduced dependencies.


---

## 📖 About

## 📚 Documentation

For complete documentation, configuration options, and detailed information, please refer to the **[Full Apache2 App Documentation](https://github.com/FaserF/hassio-addons/tree/master/apache2)**.

This minimal variant shares the same core functionality and configuration options as the full version, but with reduced dependencies.

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
