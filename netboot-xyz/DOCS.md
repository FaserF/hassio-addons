# Netboot.xyz Documentation

PXE-Server to deploy a OS inside your local network.

## ⚙️ Configuration

Configure the add-on via the **Configuration** tab in the Home Assistant add-on page.

### Options

```yaml
dhcp_range: 192.168.178.200
path: /media/netboot/image
path_config: /media/netboot/config
```

### Network Ports

| Port | Protocol | Required | Description                                                                  |
| ---- | -------- | -------- | ---------------------------------------------------------------------------- |
| 85   | TCP      | ✅ Yes   | NGINX server for hosting boot assets. **Must stay at port 85 for PXE boot!** |
| 69   | UDP      | ✅ Yes   | TFTP server. **Must stay at port 69 for PXE boot!**                          |
| 3000 | TCP      | ❌ No    | Web configuration interface (uses Ingress, can be changed)                   |

> ⚠️ **Warning**: Changing ports 85 or 69 will break PXE boot functionality. Only the web UI port (3000) can be safely modified.

### Requirements

> ⚠️ **Important**: This add-on requires **Protection mode** to be **disabled** because it needs full network access for PXE/DHCP functionality. The add-on will fail to start if protection mode is enabled.

## 📂 Folder Usage

- `/media`: Used for storing boot images and configuration files. Path and config path are configurable via options:
  - `path`: `/media/netboot/image` (Location for bootable ISOs/images)
  - `path_config`: `/media/netboot/config` (Location for menu and instance configuration)
- `/data`: Used internally by the add-on for persistent meta-data storage.

## ⚠️ Secure Boot

**IMPORTANT**: netboot.xyz does **NOT** support Secure Boot!

The iPXE binaries used by netboot.xyz are not signed by Microsoft, which means they will fail Secure Boot's signature verification.

### If you see "signature verification failed" errors

1. Enter your computer's BIOS/UEFI settings (usually F2, F10, F12, or Del during boot)
2. Navigate to the Security or Boot settings
3. **Disable Secure Boot**
4. Save changes and reboot
5. Try PXE booting again

### Why is this necessary?

Secure Boot requires all boot loaders to be cryptographically signed by a trusted authority (typically Microsoft). Since netboot.xyz uses open-source iPXE binaries that are not Microsoft-signed, they cannot pass Secure Boot verification.

## Support

For issues and feature requests, please use the GitHub repository issues.
