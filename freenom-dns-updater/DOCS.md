# Freenom-dns-updater Documentation

Freenom DNS Updater for Homeassistant OS

Freenom is a (free) Registrar provider. This is a docker image based on @maxisoft 's work from his [Freenom DNS Updater](https://github.com/maxisoft/Freenom-dns-updater).

The full feature list can be found there.

## ⚙️ Configuration

Configure the add-on via the **Configuration** tab in the Home Assistant add-on page.

### Options

```yaml
config_file: null
update_time_in_seconds: 86400
```

## 📂 Folder Usage

- `/share`: Used to store the Freenom configuration file. This allows you to easily edit the configuration from outside the add-on container.
- `/data`: Used internally by the add-on for persistent storage.

## Support

For issues and feature requests, please use the GitHub repository issues.
