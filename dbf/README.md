# DBF (DB-Infoscreen)

<img src="https://raw.githubusercontent.com/FaserF/hassio-addons/master/dbf/logo.png" width="100" alt="Logo" />

[![Open your Home Assistant instance and show the app dashboard.](https://my.home-assistant.io/badges/supervisor_addon.svg)](https://my.home-assistant.io/redirect/supervisor_addon/?addon=c1e285b7_dbf)
[![Home Assistant App](https://img.shields.io/badge/home%20assistant-app-blue.svg)](https://www.home-assistant.io/apps/)
[![Docker Image](https://img.shields.io/badge/docker-1.0.0-blue.svg?logo=docker&style=flat-square)](https://github.com/FaserF/hassio-addons/pkgs/container/hassio-addons-dbf)
![Project Maintenance](https://img.shields.io/badge/maintainer-FaserF-blue?style=flat-square)

> Railway departure display (formerly db-fakescreen) as a Home Assistant App.

---

## 📖 About

**DBF (DB-Infoscreen)** is a web application that displays railway departures for public transit stops. It provides detailed information including delay reasons, service limitations, wagon orders, and expected train types.

This add-on brings the powerful `db-infoscreen` software to Home Assistant, allowing you to have a professional departure board in your smart home.

## 🚀 Features

- 🚉 **Real-time Departures**: Accurate information from various backends (IRIS, HAFAS).
- 🕒 **Delay Tracking**: See actual delays and reasons.
- 🚋 **Wagon Orders**: View the composition of IC/ICE trains.
- 🎨 **Customizable**: Multiple display modes including a dedicated "Infoscreen" mode.
- 🔒 **Privacy First**: Self-hosted and privacy-focused.
- 🧩 **Automatic Integration**: Automatically installs and updates the [DB Infoscreen Integration](https://github.com/FaserF/ha-db_infoscreen).

## 🧩 Home Assistant Integration

This add-on is designed to work seamlessly with the **DB Infoscreen Integration**.

- **Auto-Installation**: When you start this add-on, it will automatically check if the integration is installed in your `custom_components` folder. If missing or outdated, it will dynamically fetch and install the latest release directly from GitHub.
- **Manual Control**: You can also find the source code and report issues for the integration at: [github.com/FaserF/ha-db_infoscreen](https://github.com/FaserF/ha-db_infoscreen).

## 📦 Installation

1. Add this repository to your Home Assistant Supervisor.
2. Search for "DBF" in the Add-on Store.
3. Install the add-on.
4. Start the add-on and open the Web UI via Ingress.

---

## ⚙️ Configuration

Configure the app via the **Configuration** tab in the Home Assistant App page.

### Options

```yaml
imprint_address: ''
imprint_name: ''
log_level: info
privacy_policy_url: ''
workers: 2
```

---

## 👨‍💻 Credits & License

This project is open-source and available under the MIT License.
Maintained by **FaserF**.
