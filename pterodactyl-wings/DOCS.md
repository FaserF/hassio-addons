# pterodactyl Wings Documentation

pterodactyl Wings (Daemon) Gameserver for Homeassistant OS

Pterodactyl® is a free, open-source game server management panel built with PHP, React, and Go. Designed with security in mind, Pterodactyl runs all game servers in isolated Docker containers while exposing a beautiful and intuitive UI to end users.

## ⚙️ Configuration

Configure the add-on via the **Configuration** tab in the Home Assistant add-on page.

### Options

```yaml
config_file: null
```

## 📂 Folder Usage

- `/share`: Mapped for sharing files between Wings and the Panel or other add-ons.
- `/data`: Used for persistent storage of Wings' internal data and game server files.

## Requirements

The MariaDB Integration is needed before installing this one!

## Support

For issues and feature requests, please use the GitHub repository issues.
