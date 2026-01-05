# pterodactyl Wings Documentation

pterodactyl Wings (Daemon) Gameserver for Homeassistant OS

Pterodactyl® is a free, open-source game server management panel built with PHP, React, and Go. Designed with security in mind, Pterodactyl runs all game servers in isolated Docker containers while exposing a beautiful and intuitive UI to end users.

## ⚙️ Configuration

Configure the add-on via the **Configuration** tab in the Home Assistant add-on page.

### Options

```yaml
config_file: /share/pterodactyl/config.yml
```

### Initial Setup

1. **Start the Add-on**: If the configuration file defined in `config_file` does not exist, the add-on will create a default one for you at that location.
2. **Access Pterodactyl Panel**: Go to your Pterodactyl Panel (e.g., using the `pterodactyl-panel` add-on).
3. **Create Node**: Navigate to the Admin View -> Nodes and create a new node.
4. **Get Configuration**: Click on the 'Configuration' tab of your newly created node.
5. **Update Config File**: Copy the YAML Configuration block shown in the Panel and paste it into your `config.yml` file (default: `/share/pterodactyl/config.yml`).
   - **Note**: Ensure the paths in the config file match your Home Assistant environment. The default template already sets `data: /share/pterodactyl/data` and SSL paths to `/ssl/...`.
6. **Restart Wings**: Restart this add-on to apply the configuration.

## 📂 Folder Usage

- `/share`: Mapped for sharing files between Wings and the Panel or other add-ons.
- `/data`: Used for persistent storage of Wings' internal data and game server files.

## Requirements

The MariaDB Integration is needed before installing this one!

## Support

For issues and feature requests, please use the GitHub repository issues.
