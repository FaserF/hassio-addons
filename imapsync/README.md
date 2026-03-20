# Imapsync

<img src="https://raw.githubusercontent.com/FaserF/hassio-addons/master/imapsync/logo.png" width="100" alt="Logo" />

[![Open your Home Assistant instance and show the add-on dashboard.](https://my.home-assistant.io/badges/supervisor_addon.svg)](https://my.home-assistant.io/redirect/supervisor_addon/?addon=c1e285b7_imapsync)
[![Home Assistant App](https://img.shields.io/badge/home%20assistant-addon-blue.svg)](https://www.home-assistant.io/addons/)
[![Docker Image](https://img.shields.io/badge/docker-0.3.0-blue.svg?logo=docker&style=flat-square)](https://github.com/FaserF/hassio-addons/pkgs/container/hassio-addons-imapsync)
![Project Maintenance](https://img.shields.io/badge/maintainer-FaserF-blue?style=flat-square)

> Sync IMAP accounts easily and reliably.

---

> [!CAUTION]
> **Experimental / Beta Status**
>
> This add-on is still in development and/or primarily developed for personal use.
> It is not extensively tested yet, but is expected to work fundamentally.

---

## 📖 About

## ❤️ Support This Project

> I maintain all these add-ons in my **free time alongside a regular job**. Test devices cost money, and every donation helps me stay independent and invest more time into open-source work.
>
> Donations are completely voluntary — but the more support I receive, the less I depend on other income and the more time I can dedicate to these projects.

<div align="center">

</div>

This add-on is a Home Assistant wrapper around the industry-standard [imapsync](https://github.com/imapsync/imapsync) tool for IMAP email synchronization.

**Key features:**

- 🔄 **Incremental sync** — only copies new or changed messages, stops and resumes efficiently
- 📁 **Folder filtering** — sync only selected folders (e.g. just Inbox) or exclude specific ones (e.g. Trash/Spam)
- 🔐 **OAuth2 support** — works with Google (Gmail) and Microsoft (Office 365/Outlook)
- 📬 **Multi-job** — run multiple sync jobs sequentially (one after another)
- ⏱️ **Scheduled** — configure the sync interval (minimum 90 seconds)
- 📊 **Log summary** — always shows transferred/skipped/error counts after each sync

## 🐛 Report a Bug

If you encounter any issues with this add-on, please report them using the link below.

**[Report a Bug](https://github.com/FaserF/hassio-addons/issues/new?template=bug_report.yml&App_name=imapsync)**

## 💡 Feature Request

**[Request a Feature](https://github.com/FaserF/hassio-addons/issues/new?template=feature_request.yml&App_name=imapsync)**

---

## ⚙️ Configuration

Configure the add-on via the **Configuration** tab in the Home Assistant App page.

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
