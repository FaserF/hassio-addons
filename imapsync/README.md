# Imapsync

<img src="https://raw.githubusercontent.com/FaserF/hassio-addons/master/imapsync/logo.png" width="100" alt="Logo" />

[![Open your Home Assistant instance and show the app dashboard.](https://my.home-assistant.io/badges/supervisor_addon.svg)](https://my.home-assistant.io/redirect/supervisor_addon/?addon=605cee21_imapsync)
[![Home Assistant App](https://img.shields.io/badge/home%20assistant-app-blue.svg)](https://www.home-assistant.io/apps/)
[![Docker Image](https://img.shields.io/badge/docker-0.4.1-blue.svg?logo=docker&style=flat-square)](https://github.com/FaserF/hassio-addons/pkgs/container/hassio-addons-imapsync)
![Project Maintenance](https://img.shields.io/badge/maintainer-FaserF-blue?style=flat-square)

> Sync IMAP accounts easily and reliably.

---

> [!CAUTION]
> **Experimental / Beta Status**
>
> This App is still in development and/or primarily developed for personal use.
> It is not extensively testet yet, but is expected to work fundamentally.

---

## 📖 About

Sync IMAP accounts easily and reliably.

---

## ⚙️ Configuration

Configure the app via the **Configuration** tab in the Home Assistant App page.

### Options

```yaml
jobs:
  - additional_cli_args: []
    delete_after_sync: false
    destination_auth_type: password
    destination_host: imap.example.net
    destination_oauth2_client_id: ''
    destination_oauth2_client_secret: ''
    destination_oauth2_refresh_token: ''
    destination_oauth2_tenant_id: ''
    destination_password: ''
    destination_user: dest@example.net
    dry_run: false
    excluded_folders: []
    included_folders: []
    max_age: 0
    max_size: 0
    source_auth_type: password
    source_host: imap.example.com
    source_oauth2_client_id: ''
    source_oauth2_client_secret: ''
    source_oauth2_refresh_token: ''
    source_oauth2_tenant_id: ''
    source_password: ''
    source_user: source@example.com
    subscribe_folders: true
    sync_gmail_labels: false
    sync_internal_dates: true
log_level: info
sync_interval: 3600
```

---

## 🐛 Report a Bug

If you encounter any issues with this add-on, please report them using the link below. The issue form will be pre-filled with the add-on information to help us resolve the problem faster.

**[Report a Bug](https://github.com/FaserF/hassio-addons/issues/new?template=bug_report.yml&version_integration=0.4.1&log_information=Please+paste+the+addon+log+output+here%3A%0A%0A)**

> [!NOTE]
> Please use the link above to report problems. This ensures that all necessary information (add-on name, version, etc.) is automatically included in your bug report.

## 💡 Feature Request

If you have an idea for a new feature or improvement, please use the link below to submit a feature request. The form will be pre-filled with the add-on information.

**[Request a Feature](https://github.com/FaserF/hassio-addons/issues/new?template=feature_request.yml&addon_name=imapsync)**

> [!NOTE]
> Please use the link above to request features. This ensures that the add-on name is automatically included in your feature request.

---

## 👨‍💻 Credits & License

This project is open-source and available under the MIT License.
Maintained by **FaserF**.
