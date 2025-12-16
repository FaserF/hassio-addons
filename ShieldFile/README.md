# ShieldFile Addon 🛡️📂

![Logo](logo.png)

**Secure, Web-based File Manager (SFTP over HTTPS)**

Main Project: [ShieldFile](https://github.com/FaserF/ShieldFile)

ShieldFile provides a modern, fast, and secure way to manage files on your Home Assistant host (e.g. `/share`, `/media`, `/config`).

> **Powered by [Filebrowser](https://filebrowser.org/)** ❤️
> ShieldFile wraps the amazing Filebrowser project in a "Secure-by-Default" container optimized for Home Assistant.

## ❓ Why "ShieldFile" instead of plain Filebrowser?

ShieldFile is designed specifically for **Home Assistant** and **Security**:
1.  **🔐 Secure Defaults**: ShieldFile enforces HTTPS. It automatically generates self-signed certificates if you don't have your own, ensuring your file transfers are never cleartext.
2.  **🏠 HA Integration**: It pre-mounts your critical Home Assistant folders (`/config`, `/media`, `/share`, `/backup`) so you can manage them instantly.
3.  **🛡️ Identity**: It fits perfectly into the "Shield" ecosystem (like ShieldDNS), providing a consistent, branded experience for your private cloud.

## 🤝 Compatibility
ShieldFile works perfectly alongside other official and community add-ons:
- **Advanced SSH & Web Terminal**: You can use the terminal to manage files via command line while using ShieldFile for a visual interface. Both access the same `/share`, `/config`, etc. directories.
- **FTP**: You can use an FTP client to transfer bulk files and use ShieldFile to manage them from a browser.

## Features
- **HTTPS**: Secure file transfer via browser.
- **Configurable**: Choose which directory to serve.
- **Multi-User**: Define primary users in `config.yaml`, manage robust permissions in the UI.
- **Host Network**: High performance direct binding.

## Installation

1. Install this repository in the Add-on Store.
2. Install **ShieldFile**.
3. Configure the options.
4. Start!

## Configuration

### Option: `base_directory`
The absolute path to serve.
- `/share`: Shared folder.
- `/media`: Media folder.
- `/config`: Config folder (Be careful!).

### Option: `users`
List of users. Password must be strong.
*Note: ShieldFile uses an internal database. The config option initializes users, but you can also manage them inside the Web UI (Settings > Users).*

### Option: `certfile` / `keyfile`
Your SSL certificates. If missing, a self-signed one is generated.

### Networking
Runs on **Host Network**. Default port `8443`.
ensure firewall allows this port.

## 🛡️ Security & Login

### How is it secured?
ShieldFile uses **Database Authentication**.
1.  When you open the site, you will see a **Login Screen**.
2.  Log in with the user defined in your configuration (Default: `admin`).
3.  The connection is encrypted via **HTTPS** (TLS).

### Public Access
If you publish this to the internet (e.g. via Cloudflare Tunnel):
1.  **Strong Password**: Ensure your `admin` user has a very strong password.
2.  **2FA (Recommended)**: Use Cloudflare Access (Zero Trust) to add a 2FA layer *before* the Login Screen.
3.  **Fail2Ban**: Monitor logs for failed login attempts.

## Credits
This project wouldn't exist without [Filebrowser](https://github.com/filebrowser/filebrowser). Huge thanks to the developers for their incredible work on the backend!
