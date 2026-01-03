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

| Port | Protocol | Required | Description |
|------|----------|----------|-------------|
| 85 | TCP | ✅ Yes | NGINX server for hosting boot assets. **Must stay at port 85 for PXE boot!** |
| 69 | UDP | ✅ Yes | TFTP server. **Must stay at port 69 for PXE boot!** |
| 3000 | TCP | ❌ No | Web configuration interface (uses Ingress, can be changed) |

> ⚠️ **Warning**: Changing ports 85 or 69 will break PXE boot functionality. Only the web UI port (3000) can be safely modified.

### Requirements

> ⚠️ **Important**: This add-on requires **Protection mode** to be **disabled** because it needs full network access for PXE/DHCP functionality. The add-on will fail to start if protection mode is enabled.

## 📂 Folder Usage

- `/media`: Used for storing boot images and configuration files. Path and config path are configurable via options:
  - `path`: `/media/netboot/image` (Location for bootable ISOs/images)
  - `path_config`: `/media/netboot/config` (Location for menu and instance configuration)
- `/data`: Used internally by the add-on for persistent meta-data storage.

## Support

For issues and feature requests, please use the GitHub repository issues.
