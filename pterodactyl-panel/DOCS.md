# pterodactyl Panel Documentation

pterodactyl Panel Gameserver for Homeassistant OS

Pterodactyl® is a free, open-source game server management panel built with PHP, React, and Go. Designed with security in mind, Pterodactyl runs all game servers in isolated Docker containers while exposing a beautiful and intuitive UI to end users.

> [!WARNING]
> Currently only limited working. Right now it can be considered beta and unstable. Don't blame me if your gameservers would be lost etc.
>
> For me I am unable to login until now. Seems to have something to do with redis, but I dont get what exactly.

## ⚙️ Configuration

Configure the add-on via the **Configuration** tab in the Home Assistant add-on page.

### Options

```yaml
certfile: fullchain.pem
keyfile: privkey.pem
log_level: info
password: ''
ssl: true
```

## 📂 Folder Usage

- `/share`: Mapped for sharing files between the panel and other add-ons or the host.
- `/ssl`: Used for SSL certificates (`certfile` and `keyfile`). Required if `ssl: true` is enabled.
- `/data`: Used for persistent storage of the panel's internal data, including the application code and local settings.

## Support

For issues and feature requests, please use the GitHub repository issues.
