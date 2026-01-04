# Antigravity-Server Documentation

Stream the Antigravity AI IDE (Linux Desktop with XFCE4) via NoVNC in your browser.

## ⚙️ Configuration

Configure the add-on via the **Configuration** tab in the Home Assistant add-on page.

### Options

```yaml
log_level: info
vnc_password: ''
```

## 📂 Folder Usage

- `/share`: Mapped with read/write access, allowing you to easily share files between the Antigravity desktop and other Home Assistant add-ons or the host.
- `/data`: Used for persistent storage of the user's home directory (`/home/antigravity`) and system configurations.

## Support

For issues and feature requests, please use the GitHub repository issues.
