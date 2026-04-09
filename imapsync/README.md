# Imapsync

<img src="https://raw.githubusercontent.com/FaserF/hassio-addons/master/imapsync/logo.png" width="100" alt="Logo" />

[![Open your Home Assistant instance and show the app dashboard.](https://my.home-assistant.io/badges/supervisor_addon.svg)](https://my.home-assistant.io/redirect/supervisor_addon/?addon=c1e285b7_imapsync)
[![Home Assistant App](https://img.shields.io/badge/home%20assistant-app-blue.svg)](https://www.home-assistant.io/apps/)
[![Docker Image](https://img.shields.io/badge/docker-0.3.1-blue.svg?logo=docker&style=flat-square)](https://github.com/FaserF/hassio-addons/pkgs/container/hassio-addons-imapsync)
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

## 👨‍💻 Credits & License

This project is open-source and available under the MIT License.
Maintained by **FaserF**.
