# xqrepack

![Logo](logo.png)

[![Open your Home Assistant instance and show the add-on dashboard.](https://my.home-assistant.io/badges/supervisor_addon.svg)](https://my.home-assistant.io/redirect/supervisor_addon/?addon=c1e285b7_xqrepack)
[![Home Assistant Add-on](https://img.shields.io/badge/home%20assistant-addon-blue.svg)](https://www.home-assistant.io/addons/)
[![GitHub Release](https://img.shields.io/github/v/release/FaserF/hassio-addons?include_prereleases&style=flat-square)](https://github.com/FaserF/hassio-addons/releases)
![Project Maintenance](https://img.shields.io/badge/maintainer-FaserF-blue?style=flat-square)

> These scripts allow you to modify the different Xiaomi router firmware images to make sure SSH and UART access is always enabled. (Unsupported)

---

## 📖 About

xqrepack - Repack and rebuild MiWifi Images to gain SSH access and other stuff.

These scripts allow you to modify the Xiaomi R3600 (AX3600) / rm1800 (AX1800)
firmware image to make sure SSH and UART access is always enabled.

The default root password is password. Please remember to login to the router and
change that after the upgrade. Your router settings like IP address and SSIDs are
stored in the nvram and should stay the same.

⚠ The script also tries its best to remove or disable phone-home binaries, and
also the smart controller (AIoT) parts, leaving you with a (close to) OpenWRT
router that you can configure via UCI or /etc/config. Between preserving stock
functionality and privacy concerns, I would err on the side of caution and rather
that some functionality be sacrificed for a router that I have more confidence to
connect to the Internet.

Note that in order to get SSH access to the router initially, you need to
downgrade to version 1.0.17 and exploit it first. Once you have SSH, you can use
this repacking method to maintain SSH access for newer versions.

Please visit @geekman original repo of this program:
<https://github.com/geekman/xqrepack>

## Installation

The installation of this add-on is pretty straightforward and not different in
comparison to installing any other custom Home Assistant add-on.

Just click the link above or add my repo to the hassio addons repositorys:
<https://github.com/FaserF/hassio-addons>

The new firmware will be at your "firmware_path" folder and will be called "r3600-raw-img.bin"

---

## ⚙️ Configuration

Configure the add-on via the **Configuration** tab in the Home Assistant add-on page.

### Options

```yaml
firmware_name: miwifi_r3600_firmware.bin
firmware_path: /share/miwifi_firmware/
```

---

## 📂 Folder Usage

- `/share`: Used for `firmware_path`. This is where the add-on looks for the original firmware and where the modified firmware will be saved.
- `/data`: Used internally by the add-on for persistent meta-data storage.

---

## 👨‍💻 Credits & License

This project is open-source and available under the MIT License.
Maintained by **FaserF**.
