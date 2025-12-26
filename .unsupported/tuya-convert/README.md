# tuya-convert BETA

> [!CAUTION]
> **EDGE/DEVELOPMENT BUILD**
>
> You are viewing the `edge` branch. This version is built locally from source
> and may contain bugs or incomplete features. For stable releases, switch to
> the `master` branch or use the stable repository URL.



![Logo](logo.png)

[![Open your Home Assistant instance and show the add-on dashboard.](https://my.home-assistant.io/badges/supervisor_addon.svg)](https://my.home-assistant.io/redirect/supervisor_addon/?addon=c1e285b7_tuya-convert)
[![Home Assistant Add-on](https://img.shields.io/badge/home%20assistant-addon-blue.svg)](https://www.home-assistant.io/addons/)
[![GitHub Release](https://img.shields.io/github/v/release/FaserF/hassio-addons?include_prereleases&style=flat-square)](https://github.com/FaserF/hassio-addons/releases)
![Project Maintenance](https://img.shields.io/badge/maintainer-FaserF-blue?style=flat-square)

> Tuya Convert - Flash Tuya devices with open Source software (Beta/Deprecated) (Unsupported)

---

> [!CAUTION]
> **Experimental / Beta Status**
>
> This add-on is still in development and/or primarily developed for personal use.
> It is not extensively tested yet, but is expected to work fundamentally.

---

## 📖 About

<!-- markdownlint-disable MD033 MD013 -->
<div align="center">
  <br>
  <strong>Flash Tuya devices over the air!</strong>
  <br>
</div>
<!-- markdownlint-enable MD033 MD013 -->

## ⚠️ Important Note

> [!WARNING]
> **Deprecated / Experimental**: This add-on is experimental. Tuya has patched
> newer firmwares to prevent this OTA hack. Use at your own risk!
> Please prefer using the standalone installation of `tuya-convert` on a
> Raspberry Pi or Linux laptop for better success rates.

**Tuya-Convert** allows you to free your Tuya-based smart devices (plugs,
switches, bulbs) from the cloud by flashing them with custom firmware like
**Tasmota** or **ESPHome**—without soldering! This add-on brings the famous
Tuya-Convert tool directly to your Home Assistant OS environment.

## ✨ Features

- **🔓 Cloud Free**: Flash custom firmware and take local control.
- **🛠️ Tasmota & ESPurna**: Supports major custom firmwares out of the box.
- **🏠 Home Assistant**: Integrated into your HA supervisor.

## 🚀 Installation

1. Add this repository to your **Home Assistant Add-on Store**.
1. Install the **Tuya-Convert** add-on.
1. Configure the `firmware` option.
1. Start the add-on.

---

## ⚙️ Configuration

Configure the add-on via the **Configuration** tab in the Home Assistant add-on page.

### Options

```yaml
accept_eula: 'false'
backup_path: /share/tuya-convert/
firmware: tasmota.bin
```

---

## 👨‍💻 Credits & License

This project is open-source and available under the MIT License.
Maintained by **FaserF**.
