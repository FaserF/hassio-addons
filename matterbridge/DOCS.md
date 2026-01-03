# Matterbridge Documentation

A simple chat bridge between different messanger apps.

## ⚙️ Configuration

Configure the add-on via the **Configuration** tab in the Home Assistant add-on page.

### Options

```yaml
config_path: /share/matterbridge/matterbridge.toml
log_level: info
```

## 📂 Folder Usage

- `/share`: Used to store the `matterbridge.toml` configuration file. This allows for easy editing of the configuration from outside the container.
- `/data`: Used internally by the add-on for persistent storage and session data.

## Support

For issues and feature requests, please use the GitHub repository issues.
