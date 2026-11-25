# Antigravity-Server Documentation

> [!CAUTION]
> **UNSUPPORTED ADD-ON**
>
> This add-on is deprecated and no longer supported. Please use [Antigravity Remote (antigravity.google.com)](https://antigravity.google.com) or the [Paseo Add-on](https://github.com/FaserF/hassio-addons/tree/master/paseo) instead.

Stream the Antigravity AI IDE (Linux Desktop with XFCE4) via NoVNC in your browser.

## ⚙️ Configuration

Configure the app via the **Configuration** tab in the Home Assistant App page.

### Options

```yaml
log_level: info
vnc_password: ''
autostart_antigravity: true
```

- `log_level`: Level of logs to output.
- `vnc_password`: (Optional) Set a custom password for VNC access (max 8 characters).
- `autostart_antigravity`: (Default: `true`) If set to `true`, the Antigravity IDE will start automatically when the desktop session begins.

## 📋 Features

- **Google Chrome**: Pre-installed and configured as the default browser with first-run screens suppressed.
- **Clipboard Sync**: Host-to-browser clipboard synchronization is enabled via `autocutsel`. Use the NoVNC sidebar to access the clipboard if direct sync isn't supported by your browser.

## 📂 Folder Usage

- `/share`: Mapped with read/write access, allowing you to easily share files between the Antigravity desktop and other Home Assistant Apps or the host.
- `/data`: Used for persistent storage of the user's home directory (`/home/antigravity`) and system configurations.

## Support

For issues and feature requests, please use the GitHub repository issues.
