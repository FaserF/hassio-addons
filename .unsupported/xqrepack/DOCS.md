# xqrepack Documentation

These scripts allow you to modify the different Xiaomi router firmware images to make sure SSH and UART access is always enabled. (Unsupported)

xqrepack - Repack and rebuild MiWifi Images to gain SSH access and other stuff.

These scripts allow you to modify the Xiaomi R3600 (AX3600) / rm1800 (AX1800) firmware image to make sure SSH and UART access is always enabled.

The default root password is password. Please remember to login to the router and change that after the upgrade. Your router settings like IP address and SSIDs are stored in the nvram and should stay the same.

⚠ The script also tries its best to remove or disable phone-home binaries, and also the smart controller (AIoT) parts, leaving you with a (close to) OpenWRT router that you can configure via UCI or /etc/config. Between preserving stock functionality and privacy concerns, I would err on the side of caution and rather that some functionality be sacrificed for a router that I have more confidence to connect to the Internet.

Note that in order to get SSH access to the router initially, you need to downgrade to version 1.0.17 and exploit it first. Once you have SSH, you can use this repacking method to maintain SSH access for newer versions.

Please visit @geekman original repo of this program: <https://github.com/geekman/xqrepack>

## ⚙️ Configuration

Configure the add-on via the **Configuration** tab in the Home Assistant add-on page.

### Options

```yaml
firmware_name: miwifi_r3600_firmware.bin
firmware_path: /share/miwifi_firmware/
```

## 📂 Folder Usage

- `/share`: Used for `firmware_path`. This is where the add-on looks for the original firmware and where the modified firmware will be saved.
- `/data`: Used internally by the add-on for persistent meta-data storage.

## Support

For issues and feature requests, please use the GitHub repository issues.
