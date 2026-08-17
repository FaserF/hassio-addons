# EntraMirror

<img src="https://raw.githubusercontent.com/FaserF/hassio-addons/master/EntraMirror/logo.png" width="100" alt="Logo" />

[![Home Assistant App](https://img.shields.io/badge/home%20assistant-app-blue.svg)](https://www.home-assistant.io/apps/)
[![Docker Image](https://img.shields.io/badge/docker-0.1.0-blue.svg?logo=docker&style=flat-square)](https://github.com/FaserF/hassio-addons/pkgs/container/hassio-addons-entramirror)
![Project Maintenance](https://img.shields.io/badge/maintainer-FaserF-blue?style=flat-square)

> Microsoft Entra ID Tenant Backup, Restore, Synchronization & Cloning for Home Assistant.

---

> [!CAUTION]
> **Experimental / Beta Status**
>
> This App is currently in active development.

---

## 📖 About

EntraMirror provides tenant backup, restore, sync and disaster recovery capabilities for Microsoft Entra ID environments.

---

## ⚙️ Configuration

Configure the app via the **Configuration** tab in Home Assistant.

### Options

```yaml
version: "latest"
github_token: ""
github_repo: "FaserF/EntraMirror"
developer_mode: false
reset_database: false
log_level: "info"
secret_key: ""
debug: false
sso_enabled: false
sso_client_id: ""
sso_tenant_id: "common"
```

---

## 👨‍💻 Credits & License

This project is licensed under the MIT License.
Maintained by **FaserF**.
