# Matterbridge

> [!CAUTION]
> **UNSUPPORTED ADD-ON**
>
> This add-on is no longer maintained and has been moved to the `unsupported` branch.
> It is provided for archival purposes only.
> **USE AT YOUR OWN RISK.**
>


<img src="https://raw.githubusercontent.com/FaserF/hassio-addons/master/.unsupported/matterbridge/logo.png" width="100"  alt="matterbridge Logo"/>

[![Open your Home Assistant instance and show the add-on dashboard.](https://my.home-assistant.io/badges/supervisor_addon.svg)](https://my.home-assistant.io/redirect/supervisor_addon/?addon=c1e285b7_matterbridge)
[![Home Assistant App](https://img.shields.io/badge/home%20assistant-addon-blue.svg)](https://www.home-assistant.io/addons/)
[![Docker Image](https://img.shields.io/badge/docker-2.0.0-blue.svg?logo=docker&style=flat-square)](https://github.com/FaserF/hassio-addons/pkgs/container/hassio-addons-matterbridge)
![Project Maintenance](https://img.shields.io/badge/maintainer-FaserF-blue?style=flat-square)

> A simple chat bridge (Unsupported - Matterbridge not developed since Jan 2023) (Unsupported)

---

## 📖 About

This app wraps the Matterbridge chat bridge, which allows bridging messages between different messaging platforms. However, since the upstream project is no longer maintained, this app may not work correctly with newer versions of messaging services.

## 🐛 Report a Bug

> [!WARNING]
> **No Support Provided**
>
> Since Matterbridge has not been developed since January 2023, bug reports will likely not be addressed. This app is provided "as-is" for archival purposes only.

## 💡 Feature Request

> [!WARNING]
> **No Support Provided**
>
> Due to the abandoned state of the upstream project, feature requests will not be implemented.

---

## ⚙️ Configuration

Configure the add-on via the **Configuration** tab in the Home Assistant App page.

### Options

```yaml
config_path: /share/matterbridge/matterbridge.toml
log_level: info
```

---

## 👨‍💻 Credits & License

This project is open-source and available under the MIT License.
Maintained by **FaserF**.
