# Wiki.js V3 (Beta) Documentation

Wiki.js V3 (Beta) for Homeassistant OS

The most powerful and extensible open source Wiki software. Make documentation a joy to write using Wiki.js's beautiful and intuitive interface!

**⚠️ Important:** This is the Beta version of Wiki.js. For production environments, please use the stable [Wiki.js V2 addon](../wiki.js/DOCS.md) instead.

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

## 🔄 Version Information

This addon automatically updates to the latest Wiki.js V3 Beta releases. The addon version and Wiki.js version may differ - the addon version reflects the addon itself, while Wiki.js V3 is updated automatically from the official Docker image.

## Support

For issues and feature requests, please use the GitHub repository issues.
