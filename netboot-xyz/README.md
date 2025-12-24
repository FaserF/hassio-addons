# Netboot.xyz

![Logo](logo.png)

[![Open your Home Assistant instance and show the add-on dashboard.](https://my.home-assistant.io/badges/supervisor_addon.svg)](https://my.home-assistant.io/redirect/supervisor_addon/?addon=c1e285b7_netboot-xyz)
[![Home Assistant Add-on](https://img.shields.io/badge/home%20assistant-addon-blue.svg)](https://www.home-assistant.io/addons/)
[![GitHub Release](https://img.shields.io/github/v/release/FaserF/hassio-addons?include_prereleases&style=flat-square)](https://github.com/FaserF/hassio-addons/releases)
![Project Maintenance](https://img.shields.io/badge/maintainer-FaserF-blue?style=flat-square)

> PXE-Server to deploy a OS inside your local network

---

## 📖 About

<!-- markdownlint-disable MD033 MD013 -->
<div align="center">
  <img src="https://raw.githubusercontent.com/FaserF/hassio-addons/master/netboot-xyz/icon.png" alt="Netboot.xyz Logo" width="100">
  <br>
  <strong>Your favorite operating systems in one place.</strong>
  <br>
</div>
<!-- markdownlint-enable MD033 MD013 -->

**Netboot.xyz** allows you to PXE boot into a wide variety of Operating System
installers and utilities from a lightweight, easy-to-use menu. This add-on lets
you host your own Netboot.xyz instance directly from your Home Assistant server,
perfect for homelabs and network management.

## ✨ Features

- **🌐 Network Booting**: Boot various OS installers and tools over the
  network.
- **🐧 Wide OS Support**: Includes major Linux distributions, utilities, and
  more.
- **🎛️ Web Interface**: Easy management via a web-based configuration UI.
- **🛠️ Customizable**: Add your own custom assets and configurations.
- **🏠 Home Assistant Ingress**: Secure, integrated access via the sidebar.

## 🚀 Installation

1. Add this repository to your **Home Assistant Add-on Store**.
1. Install the **Netboot.xyz** add-on.
1. Configure the options (see below).
1. Start the add-on.
1. Click **"OPEN WEB UI"** to manage your boot menus.
1. **Important**: Configure your home router's DHCP server to point
   `next-server` to your Home Assistant IP and file to `netboot.xyz.kpxe`.

---

## ⚙️ Configuration

Configure the add-on via the **Configuration** tab in the Home Assistant add-on page.

### Options

```yaml
dhcp_range: 192.168.178.200
path: /media/netboot/image
path_config: /media/netboot/config
```

---

## 👨‍💻 Credits & License

This project is open-source and available under the MIT License.
Maintained by **FaserF**.
