# Home Assistant Add-on: Solumati <!-- markdownlint-disable MD013 -->

<!-- markdownlint-disable MD033 MD013 -->
<div align="center">
  <img src="https://raw.githubusercontent.com/FaserF/Solumati/master/frontend/public/logo/logo-text.png" alt="Solumati Logo" width="300">
  <br>
  <strong>The Anti-Swipe Revolution</strong>
  <br>
</div>
<!-- markdownlint-enable MD033 MD013 -->

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

All options are configured via the Home Assistant UI. The database is
automatically managed.

### Options

<!-- markdownlint-disable MD013 -->
| Option                   | Type    | Default | Description                                                                  |
| :----------------------- | :------ | :------ | :--------------------------------------------------------------------------- |
| `log_level`              | select  | `info`  | Log verbosity: trace, debug, info, warning, error, fatal                     |
| `test_mode`              | boolean | `false` | Enable test mode with dummy user data for testing                            |
| `app_base_url`           | string  | (auto)  | Base URL for the app (for emails/links). Auto-detected from Ingress if empty |
| `marketing_page_enabled` | boolean | `false` | Enable the marketing page                                                    |
<!-- markdownlint-enable MD013 -->

> **Note**: OAuth providers and SMTP settings are configured in the
> **Admin Panel** after first login, not here.

### ⚠️ Factory Reset (Danger Zone)

<!-- markdownlint-disable MD013 MD060 -->
| Option | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `factory_reset` | `boolean` | `false` | **DANGEROUS!** Permanently deletes ALL data on next restart. **Disable immediately after use.** |
<!-- markdownlint-enable MD013 MD060 -->

> [!CAUTION]
> Enabling `factory_reset` will **permanently delete**:
>
> * All user accounts and profiles
> * All messages and conversations
> * All uploaded images
> * All settings and configurations
>
> This cannot be undone! After the reset, you must disable this option manually,
> otherwise your data will be wiped again on each restart.

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
