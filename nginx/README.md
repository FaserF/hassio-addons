# NGINX

<img src="logo.png" alt="Logo" width="200">

[![Open your Home Assistant instance and show the add-on dashboard.](https://my.home-assistant.io/badges/supervisor_addon.svg)](https://my.home-assistant.io/redirect/supervisor_addon/?addon=c1e285b7_nginx)
[![Home Assistant Add-on](https://img.shields.io/badge/home%20assistant-addon-blue.svg)](https://www.home-assistant.io/addons/)
[![GitHub Release](https://img.shields.io/github/v/release/FaserF/hassio-addons?include_prereleases&style=flat-square)](https://github.com/FaserF/hassio-addons/releases)
![Project Maintenance](https://img.shields.io/badge/maintainer-FaserF-blue?style=flat-square)

> Open Source Webserver with PHP and MariaDB.

---

## 📖 About

A lightweight NGINX web server for Home Assistant OS, with optional PHP 8 and MariaDB support.

## 🚀 Installation

1. Add the repository to Home Assistant.
2. Install the `NGINX` add-on via Supervisor.
3. Place your website files in `document_root` (Default: `/share/htdocs`).
4. Start the add-on.

## 🔒 SSL/HTTPS Configuration

> **⚠️ Important**: SSL is **disabled by default** to allow the add-on to start without pre-existing certificates.

To enable SSL/HTTPS:

1. **Place your SSL certificates** in the `/ssl` directory:
   - Certificate file: `/ssl/fullchain.pem` (or your custom filename)
   - Private key file: `/ssl/privkey.pem` (or your custom filename)

2. **Update the configuration** to enable SSL:

   ```yaml
   ssl: true
   certfile: fullchain.pem
   keyfile: privkey.pem
   ```

3. **Restart the add-on** to apply the changes.

**Note**: The add-on will fail to start if `ssl: true` is set but the certificate files are missing. Ensure certificates are in place before enabling SSL.

## 📝 Documentation

For detailed information, configuration, and folder usage, please refer to the **[Documentation](DOCS.md)** (also available via the **Documentation** tab in the Home Assistant interface).

---

## 👨‍💻 Credits & License

This project is open-source and available under the MIT License.
Maintained by **FaserF**.
