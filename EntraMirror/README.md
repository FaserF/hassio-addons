# EntraMirror

<img src="https://raw.githubusercontent.com/FaserF/hassio-addons/master/EntraMirror/logo.png" width="100" alt="Logo" />

[![Open your Home Assistant instance and show the app dashboard.](https://my.home-assistant.io/badges/supervisor_addon.svg)](https://my.home-assistant.io/redirect/supervisor_addon/?addon=605cee21_EntraMirror)
[![Home Assistant App](https://img.shields.io/badge/home%20assistant-app-blue.svg)](https://www.home-assistant.io/apps/)
[![Docker Image](https://img.shields.io/badge/docker-0.1.1-blue.svg?logo=docker&style=flat-square)](https://github.com/FaserF/hassio-addons/pkgs/container/hassio-addons-entramirror)
![Project Maintenance](https://img.shields.io/badge/maintainer-FaserF-blue?style=flat-square)

> Microsoft Entra ID Tenant Backup, Restore, Synchronization & Cloning for Home Assistant.

---

> [!CAUTION]
> **Development / Edge Channel Only**
>
> This add-on is currently in active development and provided exclusively on the **Edge** branch.
> While the Home Assistant add-on wrapper itself may be functional, the underlying upstream software is either in an early development stage or hosted within a private repository.
>
> 💡 To test or use this add-on, install the repository via the Edge channel: `https://github.com/FaserF/hassio-addons#edge`

---

## 📖 About

EntraMirror provides tenant backup, restore, sync and disaster recovery capabilities for Microsoft Entra ID environments.

---

## ⚙️ Configuration

Configure the app via the **Configuration** tab in the Home Assistant App page.

### Options

```yaml
debug: false
developer_mode: false
github_repo: FaserF/EntraMirror
github_token: ''
log_level: info
reset_database: false
secret_key: ''
sso_client_id: ''
sso_enabled: false
sso_tenant_id: common
version: latest
```

---

## 👨‍💻 Credits & License

This project is open-source and available under the MIT License.
Maintained by **FaserF**.
