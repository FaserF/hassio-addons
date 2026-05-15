# Antigravity-Server

> [!CAUTION]
> **EDGE/DEVELOPMENT BUILD**
>
> You are viewing the `edge` branch. This version is built locally from source
> and may contain bugs or incomplete features. For stable releases, switch to
> the `master` branch or use the stable repository URL.



<img src="https://raw.githubusercontent.com/FaserF/hassio-addons/master/antigravity-server/logo.png" width="100" alt="Logo" />

[![Open your Home Assistant instance and show the app dashboard.](https://my.home-assistant.io/badges/supervisor_addon.svg)](https://my.home-assistant.io/redirect/supervisor_addon/?addon=edfe50eb_antigravity-server)
[![Home Assistant App](https://img.shields.io/badge/home%20assistant-app-blue.svg)](https://www.home-assistant.io/apps/)
[![Docker Image](https://img.shields.io/badge/docker-1.2.2-blue.svg?logo=docker&style=flat-square)](https://github.com/FaserF/hassio-addons/pkgs/container/hassio-addons-antigravity-server)
![Project Maintenance](https://img.shields.io/badge/maintainer-FaserF-blue?style=flat-square)

> Stream the Antigravity AI IDE (Linux Desktop with XFCE4) via NoVNC in your browser.

---

## 📖 About

Stream the Antigravity AI IDE (Linux Desktop with XFCE4) via NoVNC in your browser.

### Advanced Features

- **Dynamic Toolsets**: Enable specialized tools for Android, C++/Dev, Windows (MinGW), or Linters on-the-fly.
- **Persistence**: Your settings and tools persist in the `/data` directory.
- **Ingress Support**: Securely access the desktop via Home Assistant Ingress.

---

## ⚙️ Configuration

Configure the app via the **Configuration** tab in the Home Assistant App page.

### Options

```yaml
additional_packages: []
autostart_antigravity: true
install_android_tools: false
install_dev_tools: false
install_linter_tools: false
install_windows_tools: false
log_level: info
vnc_password: ''
```

---

## 👨‍💻 Credits & License

This project is open-source and available under the MIT License.
Maintained by **FaserF**.
