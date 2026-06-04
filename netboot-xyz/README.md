# Netboot.xyz

<img src="https://raw.githubusercontent.com/FaserF/hassio-addons/master/netboot-xyz/logo.png" width="100" alt="Logo" />

[![Open your Home Assistant instance and show the app dashboard.](https://my.home-assistant.io/badges/supervisor_addon.svg)](https://my.home-assistant.io/redirect/supervisor_addon/?addon=605cee21_netboot-xyz)
[![Home Assistant App](https://img.shields.io/badge/home%20assistant-app-blue.svg)](https://www.home-assistant.io/apps/)
[![Docker Image](https://img.shields.io/badge/docker-2.3.2-blue.svg?logo=docker&style=flat-square)](https://github.com/FaserF/hassio-addons/pkgs/container/hassio-addons-netboot-xyz)
![Project Maintenance](https://img.shields.io/badge/maintainer-FaserF-blue?style=flat-square)

> PXE-Server to deploy a OS inside your local network

---

## 📖 About

## Example Configuration

An example `menu.ipxe` configuration file can be found [in the examples directory](examples/menu.ipxe).
This file demonstrates how to configure custom boot entries for Windows 11, Linux Mint, and SystemRescue.

> PXE-Server to deploy a OS inside your local network

---

## ⚙️ Configuration

Configure the app via the **Configuration** tab in the Home Assistant App page.

### Options

```yaml
dhcp_range: 192.168.1.200
log_level: info
path: /media/netboot/image
path_config: /media/netboot/config
menu_version: latest
```

- `dhcp_range` (Required): The DHCP range/proxy IP settings.
- `log_level` (Optional): The log level of the addon (e.g. `info`, `debug`, `trace`).
- `path` (Required): The storage path for netboot local assets.
- `path_config` (Required): The storage path for configurations/menus.
- `menu_version` (Optional): The version tag of the netboot.xyz menus and bootloader to use (e.g. `2.0.84` or `latest`). Set this to an older version if you experience keyboard lockup bugs with the latest upstream iPXE release.

---

## 👨‍💻 Credits & License

This project is open-source and available under the MIT License.
Maintained by **FaserF**.
