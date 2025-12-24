# Home Assistant Add-on: Tuya-Convert

<!-- markdownlint-disable MD033 MD013 -->
<div align="center">
  <img src="https://raw.githubusercontent.com/ct-Open-Source/tuya-convert/master/docs/logo.png" alt="Tuya Convert Logo" width="100">
  <br>
  <strong>Flash Tuya devices over the air!</strong>
  <br>
</div>
<!-- markdownlint-enable MD033 MD013 -->

![Supports aarch64 Architecture](https://img.shields.io/badge/aarch64-yes-green.svg)
![Supports amd64 Architecture](https://img.shields.io/badge/amd64-yes-green.svg)
![Supports armhf Architecture](https://img.shields.io/badge/armhf-yes-green.svg)
![Supports armv7 Architecture](https://img.shields.io/badge/armv7-yes-green.svg)
![Supports i386 Architecture](https://img.shields.io/badge/i386-yes-green.svg)

## ⚠️ Important Note

> [!WARNING]
> **Deprecated / Experimental**: This add-on is experimental. Tuya has patched
> newer firmwares to prevent this OTA hack. Use at your own risk!
> Please prefer using the standalone installation of `tuya-convert` on a
> Raspberry Pi or Linux laptop for better success rates.

## 📖 About

**Tuya-Convert** allows you to free your Tuya-based smart devices (plugs,
switches, bulbs) from the cloud by flashing them with custom firmware like
**Tasmota** or **ESPHome**—without soldering! This add-on brings the famous
Tuya-Convert tool directly to your Home Assistant OS environment.

## ✨ Features

* **🔓 Cloud Free**: Flash custom firmware and take local control.
* **🛠️ Tasmota & ESPurna**: Supports major custom firmwares out of the box.
* **🏠 Home Assistant**: Integrated into your HA supervisor.

## 🚀 Installation

1. Add this repository to your **Home Assistant Add-on Store**.
1. Install the **Tuya-Convert** add-on.
1. Configure the `firmware` option.
1. Start the add-on.

## ⚙️ Configuration

<!-- markdownlint-disable MD013 -->
| Option        | Type      | Default               | Description                                       |
|:--------------|:----------|:----------------------|:--------------------------------------------------|
| `backup_path` | `string`  | `/share/tuya-convert` | Location to save original firmware backups.       |
| `firmware`    | `string`  | `tasmota.bin`         | Firmware to flash (`tasmota.bin`, `espurna.bin`). |
| `accept_eula` | `boolean` | `false`               | Must be set to `true` to accept the agreement.    |
<!-- markdownlint-enable MD013 -->

> [!NOTE]
> Make sure the `backup_path` is accessible (e.g., in `/share` or `/media`).

## 📚 Usage

1. **Start the Add-on**: It will start the AP and listening process.
1. **Connect Device**: Put your Tuya device into pairing mode (fast blinking).
1. **Connect Phone**: Connect your smartphone to the `vtrust-flash` Wi-Fi
   access point created by the add-on.
1. **Watch Logs**: Follow the add-on logs to see the flashing progress.

## 🆘 Support

Encountered an issue? We're here to help.
[Open an issue on GitHub](https://github.com/FaserF/hassio-addons/issues) to
get support.

## 👨‍💻 Authors & License

Maintained by **FaserF**.
Original `tuya-convert` by **VTRUST** and **c't**.
Licensed under the **MIT License**.
