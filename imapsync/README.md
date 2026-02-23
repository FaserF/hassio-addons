# Imapsync

<img src="https://raw.githubusercontent.com/FaserF/hassio-addons/master/imapsync/logo.png" width="100" />

[![Home Assistant App](https://img.shields.io/badge/home%20assistant-addon-blue.svg)](https://www.home-assistant.io/addons/)
![Project Maintenance](https://img.shields.io/badge/maintainer-FaserF-blue?style=flat-square)

> Sync IMAP accounts easily and reliably. Perfect for seamless email migration, backup, and continuous synchronization between any two IMAP servers.

---

## ❤️ Support This Project

> I maintain all these add-ons in my **free time alongside a regular job**. Test devices cost money, and every donation helps me stay independent and invest more time into open-source work.
>
> Donations are completely voluntary — but the more support I receive, the less I depend on other income and the more time I can dedicate to these projects.

<div align="center">

[![GitHub Sponsors](https://img.shields.io/badge/Sponsor%20on-GitHub-%23EA4AAA?style=for-the-badge&logo=github-sponsors&logoColor=white)](https://github.com/sponsors/FaserF)&nbsp;&nbsp;
[![PayPal](https://img.shields.io/badge/Donate%20via-PayPal-%2300457C?style=for-the-badge&logo=paypal&logoColor=white)](https://paypal.me/FaserF)

</div>

---

## 📖 About

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

Configure the add-on via the **Configuration** tab in the Home Assistant add-on page.

### Global Options

| Option          | Default | Description                                                 |
| :-------------- | :------ | :---------------------------------------------------------- |
| `sync_interval` | `3600`  | Seconds between sync cycles (min. 90)                       |
| `log_level`     | `info`  | Log verbosity: `info`, `debug`, `trace`, `warning`, `error` |

### Job Options (per sync pair)

| Option                  | Default    | Description                                      |
| :---------------------- | :--------- | :----------------------------------------------- |
| `source_host`           | —          | Source IMAP server (e.g. `imap.yahoo.com`)       |
| `source_user`           | —          | Source username/email                            |
| `source_auth_type`      | `password` | `password` or `oauth2`                           |
| `source_password`       | —          | Source password or App Password                  |
| `destination_host`      | —          | Destination IMAP server (e.g. `imap.gmail.com`)  |
| `destination_user`      | —          | Destination username/email                       |
| `destination_auth_type` | `password` | `password` or `oauth2`                           |
| `destination_password`  | —          | Destination password or App Password             |
| `included_folders`      | `[]`       | Regex list of folders to sync (empty = all)      |
| `excluded_folders`      | `[]`       | Regex list of folders to skip                    |
| `max_age`               | `0`        | Skip messages older than X days (0 = no limit)   |
| `max_size`              | `0`        | Skip messages larger than X bytes (0 = no limit) |
| `delete_after_sync`     | `false`    | Delete from source after sync ⚠️                 |
| `dry_run`               | `false`    | Simulate sync without making changes             |

### Minimal Example

```yaml
sync_interval: 3600
log_level: info
jobs:
  - source_host: imap.mail.yahoo.com
    source_user: youraddress@yahoo.com
    source_auth_type: password
    source_password: 'your-yahoo-app-password'
    destination_host: imap.gmail.com
    destination_user: youraddress@gmail.com
    destination_auth_type: password
    destination_password: 'your-gmail-app-password'
```

> [!IMPORTANT]
> Most providers (Gmail, Yahoo, iCloud, Outlook) require an **App Password** instead of your regular account password. See [DOCS.md](DOCS.md) for provider-specific setup guides.

---

## 📚 Documentation

For complete documentation including provider-specific setup, OAuth2, advanced filtering, and troubleshooting, see **[DOCS.md](DOCS.md)**.

---

## 👨‍💻 Credits & License

- **Add-on Wrapper**: Licensed under the [MIT License](LICENSE).
- **imapsync**: The bundled tool is licensed separately under the [NOLIMIT Public License (NLPL)](https://github.com/imapsync/imapsync/blob/master/LICENSE).

Maintained by **FaserF**. Powered by [imapsync](https://github.com/imapsync/imapsync) by Gilles Lamiral.
