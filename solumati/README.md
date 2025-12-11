<!-- markdownlint-disable MD033 -->
# Home Assistant Add-on: Solumati

<div align="center">
  <img src="https://raw.githubusercontent.com/FaserF/Solumati/master/frontend/public/logo/logo-text.png" alt="Solumati Logo" width="300">
  <br>
  <strong>The Anti-Swipe Revolution</strong>
</div>
<br>

![Supports aarch64 Architecture](https://img.shields.io/badge/aarch64-yes-green.svg)
![Supports amd64 Architecture](https://img.shields.io/badge/amd64-yes-green.svg)
![Version](https://img.shields.io/badge/version-v2025.12.2--b4-blue.svg)

## 📖 About

**Solumati** is a self-hosted dating platform designed to bring meaning back to
matchmaking. By hosting this add-on, you run your own private instance of the
Solumati platform directly on your Home Assistant server, ensuring complete data
privacy and control.

## ✨ Features

* **🔒 Secure & Private**: Your data stays on your server.
* **🏠 Home Assistant Ingress**: Seamless integration via the HA sidebar with
  no port forwarding required.
* **🔌 Auto-Configuration**: Zero-config setup; the database connection is
  managed automatically.
* **🧪 Test Mode**: Includes a built-in mode to generate dummy users for safe
  testing.
* **📧 OAuth & SMTP**: Full support for external authentication and email
  notifications (configured via the Admin Panel).

## 🚀 Installation

1. Add this repository to your **Home Assistant Add-on Store**.
1. Install the **Solumati** add-on.
1. Review the **Configuration** options below.
1. Start the add-on.
1. Click **"OPEN WEB UI"** to launch the interface.

## ⚙️ Configuration

Basic options are configured directly in Home Assistant. Advanced application
settings (OAuth, SMTP) are managed within the Solumati Admin Panel.

| Option | Type | Default | Description |
|:---|:---|:---|:---|
| `log_level` | `string` | `info` | Logging verbosity (`info`, `debug`, `warning`, `error`). | <!-- markdownlint-disable-line MD013 -->
| `test_mode` | `boolean` | `false` | Enable to generate dummy data for testing purposes. | <!-- markdownlint-disable-line MD013 -->
| `app_base_url` | `string` | *(auto)* | Public URL for links/emails. Auto-detected from Ingress if left empty. | <!-- markdownlint-disable-line MD013 -->
| `marketing_page_enabled` | `boolean` | `false` | Enables the public-facing marketing landing page. | <!-- markdownlint-disable-line MD013 -->

> [!NOTE]
> **Admin Password**: On the very first startup, check the **Log** tab for the
> generated Admin password. Save this immediately!

### ⚠️ Factory Reset

> [!CAUTION]
> **DANGER ZONE**: Enabling `factory_reset` will **PERMANENTLY DELETE** all
> data, including users, messages, and images.

| Option | Type | Default | Description |
|:---|:---|:---|:---|
| `factory_reset` | `boolean` | `false` | Set to `true` and restart to wipe the database. **Disable immediately after use.** | <!-- markdownlint-disable-line MD013 -->

## 📚 Usage

### First Login

1. Start the add-on and watch the logs.
1. Copy the generated **Admin Password**.
1. Open the Web UI and log in.

### Access

* **Ingress**: Click **Solumati** in the Home Assistant sidebar.
* **Direct**: Access via `http://homeassistant.local:8099` (if configured).

## 🆘 Support

Encountered an issue? We're here to help.
[Open an issue on GitHub](https://github.com/FaserF/hassio-addons/issues) to
get support.

## 👨‍💻 Authors & License

The original **Solumati** software is created by **FaserF**.
Licensed under the **GNU Affero General Public License (AGPL)**.
