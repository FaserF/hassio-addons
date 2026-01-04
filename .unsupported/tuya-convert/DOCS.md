# tuya-convert Documentation

Tuya Convert - Flash Tuya devices with open Source software (Beta/Deprecated) (Unsupported)

> [!WARNING]
> **Deprecated / Experimental**: This add-on is experimental. Tuya has patched newer firmwares to prevent this OTA hack. Use at your own risk!
> Please prefer using the standalone installation of `tuya-convert` on a Raspberry Pi or Linux laptop for better success rates.

**Tuya-Convert** allows you to free your Tuya-based smart devices (plugs, switches, bulbs) from the cloud by flashing them with custom firmware like **Tasmota** or **ESPHome**—without soldering! This add-on brings the famous Tuya-Convert tool directly to your Home Assistant OS environment.

## ✨ Features

- **🔓 Cloud Free**: Flash custom firmware and take local control.
- **🛠️ Tasmota & ESPurna**: Supports major custom firmwares out of the box.
- **🏠 Home Assistant**: Integrated into your HA supervisor.

## ⚙️ Configuration

Configure the add-on via the **Configuration** tab in the Home Assistant add-on page.

### Options

```yaml
accept_eula: 'false'
backup_path: /share/tuya-convert/
firmware: tasmota.bin
```

## 📂 Folder Usage

- `/share`: Used for `backup_path` (Default: `/share/tuya-convert/`). This allows you to easily retrieve backups of the original firmware from outside the add-on container.
- `/data`: Used internally by the add-on for persistent storage.

## Support

For issues and feature requests, please use the GitHub repository issues.
