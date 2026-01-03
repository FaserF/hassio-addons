# Netboot.xyz

![Logo](logo.png)

[![Open your Home Assistant instance and show the add-on dashboard.](https://my.home-assistant.io/badges/supervisor_addon.svg)](https://my.home-assistant.io/redirect/supervisor_addon/?addon=c1e285b7_netboot-xyz)
[![Home Assistant Add-on](https://img.shields.io/badge/home%20assistant-addon-blue.svg)](https://www.home-assistant.io/addons/)
[![GitHub Release](https://img.shields.io/github/v/release/FaserF/hassio-addons?include_prereleases&style=flat-square)](https://github.com/FaserF/hassio-addons/releases)
![Project Maintenance](https://img.shields.io/badge/maintainer-FaserF-blue?style=flat-square)

> PXE-Server to deploy a OS inside your local network

---

## 📖 About

**Netboot.xyz** allows you to PXE boot into a wide variety of Operating System installers and utilities from a lightweight, your own Netboot.xyz instance directly from your Home Assistant server.

## 📝 Documentation

For detailed information, configuration, installation steps, and folder usage, please refer to the **[Documentation](DOCS.md)** (also available via the **Documentation** tab in the Home Assistant interface).

## 🚀 Installation

1. Add this repository to your **Home Assistant Add-on Store**.
1. Install the **Netboot.xyz** add-on.
1. Configure the options.
1. Start the add-on.
1. Click **"OPEN WEB UI"** to manage your boot menus.
1. **Important**: Configure your home router's DHCP server to point `next-server` to your Home Assistant IP and file to `netboot.xyz.kpxe`.

---

## 👨‍💻 Credits & License

This project is open-source and available under the MIT License.
Maintained by **FaserF**.
