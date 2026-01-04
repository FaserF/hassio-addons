# Wiki.js Documentation

Wiki.js for Homeassistant OS

The most powerful and extensible open source Wiki software. Make documentation a joy to write using Wiki.js's beautiful and intuitive interface!

## ⚙️ Configuration

Configure the add-on via the **Configuration** tab in the Home Assistant add-on page.

### Options

```yaml
certfile: fullchain.pem
keyfile: privkey.pem
log_level: info
ssl: true
```

## 📂 Folder Usage

- `/ssl`: Used for SSL certificates (`certfile` and `keyfile`). Required if `ssl: true` is enabled.
- `/data`: Used for persistent storage of Wiki.js application files, local database, and configurations.

## Requirements

Please ensure that the MariaDB Addon is installed!

## Support

For issues and feature requests, please use the GitHub repository issues.
