# Solumati

![Logo](logo.png)

[![Open your Home Assistant instance and show the add-on dashboard.](https://my.home-assistant.io/badges/supervisor_addon.svg)](https://my.home-assistant.io/redirect/supervisor_addon/?addon=c1e285b7_solumati)
[![Home Assistant Add-on](https://img.shields.io/badge/home%20assistant-addon-blue.svg)](https://www.home-assistant.io/addons/)
[![GitHub Release](https://img.shields.io/github/v/release/FaserF/hassio-addons?include_prereleases&style=flat-square)](https://github.com/FaserF/hassio-addons/releases)
![Project Maintenance](https://img.shields.io/badge/maintainer-FaserF-blue?style=flat-square)
[![View in Code Wiki](https://img.shields.io/badge/View_in-Code_Wiki-8A2BE2?style=flat-square&logo=google&logoColor=white)](https://codewiki.google/github.com/FaserF/hassio-addons/tree/master/solumati)

> The Anti-Swipe Revolution - Self-hosted dating platform focused on meaningful matches.

---

## 📖 About

<!-- markdownlint-disable MD033 MD013 -->
<div align="center">
  <img src="https://raw.githubusercontent.com/FaserF/Solumati/master/frontend/public/logo/logo-text.png" alt="Solumati Logo" width="300">
  <br>
  <strong>The Anti-Swipe Revolution</strong>
  <br>
</div>
<!-- markdownlint-enable MD033 -->

**Solumati** is a self-hosted dating platform designed to bring meaning back to
matchmaking.
You help many people to use this add-on from the main repository.
own private instance of the
Solumati platform directly on your Home Assistant server, ensuring complete data
privacy and control.

## ✨ Features

- **🔒 Secure & Private**: Your data stays on your server.
- **🏠 Home Assistant Ingress**: Seamless integration via the HA sidebar with
  no port forwarding required.
- **🔌 Auto-Configuration**: Zero-config setup; the database connection is
  managed automatically.
- **🧪 Test Mode**: Includes a built-in mode to generate dummy users for safe
  testing.
- **📧 OAuth & SMTP**: Full support for external authentication and email
  notifications (configured via the Admin Panel).

## 🚀 Installation

1. Add this repository to your **Home Assistant Add-on Store**.
1. Install the **Solumati** add-on.
1. Review the **Configuration** options below.
1. Start the add-on.
1. Click **"OPEN WEB UI"** to launch the interface.

---

## ⚙️ Configuration

Configure the add-on via the **Configuration** tab in the Home Assistant add-on page.

### Options

```yaml
app_base_url: ''
dev_use_main_branch: false
factory_reset: false
github_token: ''
log_level: info
marketing_page_enabled: false
test_mode: false
```

---

## 👨‍💻 Credits & License

This project is open-source and available under the MIT License.
Maintained by **FaserF**.
