# Home Assistant Add-on: Netboot.xyz

<!-- markdownlint-disable MD033 MD013 -->
<div align="center">
  <img src="https://raw.githubusercontent.com/FaserF/hassio-addons/master/netboot-xyz/icon.png" alt="Netboot.xyz Logo" width="100">
  <br>
  <strong>Your favorite operating systems in one place.</strong>
  <br>
</div>
<!-- markdownlint-enable MD033 MD013 -->

![Supports aarch64 Architecture](https://img.shields.io/badge/aarch64-yes-green.svg)
![Supports amd64 Architecture](https://img.shields.io/badge/amd64-yes-green.svg)
![Supports armhf Architecture](https://img.shields.io/badge/armhf-yes-green.svg)
![Supports armv7 Architecture](https://img.shields.io/badge/armv7-yes-green.svg)
![Supports i386 Architecture](https://img.shields.io/badge/i386-yes-green.svg)

## 📖 About

**Netboot.xyz** allows you to PXE boot into a wide variety of Operating System
installers and utilities from a lightweight, easy-to-use menu. This add-on lets
you host your own Netboot.xyz instance directly from your Home Assistant server,
perfect for homelabs and network management.

## ✨ Features

* **🌐 Network Booting**: Boot various OS installers and tools over the
  network.
* **🐧 Wide OS Support**: Includes major Linux distributions, utilities, and
  more.
* **🎛️ Web Interface**: Easy management via a web-based configuration UI.
* **🛠️ Customizable**: Add your own custom assets and configurations.
* **🏠 Home Assistant Ingress**: Secure, integrated access via the sidebar.

## 🚀 Installation

1. Add this repository to your **Home Assistant Add-on Store**.
1. Install the **Netboot.xyz** add-on.
1. Configure the options (see below).
1. Start the add-on.
1. Click **"OPEN WEB UI"** to manage your boot menus.
1. **Important**: Configure your home router's DHCP server to point
   `next-server` to your Home Assistant IP and file to `netboot.xyz.kpxe`.

## ⚙️ Configuration

<!-- markdownlint-disable MD013 -->
| Option        | Type     | Default                 | Description                                               |
|:--------------|:---------|:------------------------|:----------------------------------------------------------|
| `path`        | `string` | `/media/netboot/image`  | Directory to store local assets/images.                   |
| `path_config` | `string` | `/media/netboot/config` | Directory for persistent configuration.                   |
| `dhcp_range`  | `string` | `192.168.178.200`       | Simple DHCP range/IP if internal DHCP is used (advanced). |
<!-- markdownlint-enable MD013 -->

### 📁 Storage

The add-on requires access to your `media` folder to store images and configuration
persistently. Ensure you have the **local support** enabled in your Home Assistant
configuration or appropriate media folders available.

## 📚 Usage

1. **Start the Add-on**: Verify it starts correctly in the logs.
1. **Access Web UI**: Use the internal web interface to manage menus and
   download assets.
1. **Boot Client**: Connect a computer to your network and select "Network
   Boot" (PXE) in its BIOS. It should load the Netboot.xyz menu from your Home
   Assistant instance.

### Windows Installation

The add-on supports Windows PE booting.

1. Configure `win_base_url` in your `boot.cfg` via the Web UI.
1. Extract Windows ISO files to your configured `path`.
1. See the [Netboot.xyz Windows FAQ](https://netboot.xyz/faq/windows/) for
   detailed steps.

## 🆘 Support

Encountered an issue? We're here to help.
[Open an issue on GitHub](https://github.com/FaserF/hassio-addons/issues) to
get support.

## 👨‍💻 Authors & License

Maintained by **FaserF**.
Based on the [Netboot.xyz project](https://netboot.xyz/).
Licensed under the **MIT License**.
