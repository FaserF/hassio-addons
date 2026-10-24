# Freenom-dns-updater Documentation

Freenom DNS Updater for Homeassistant OS

Freenom is a (free) Registrar provider. This is a docker image based on @maxisoft 's work from his [Freenom DNS Updater](https://github.com/maxisoft/Freenom-dns-updater).

The full feature list can be found there.

## ⚙️ Configuration

Configure the app via the **Configuration** tab in the Home Assistant App page.

### Options

```yaml
config_file: null
update_time_in_seconds: 86400
```

## 📂 Folder Usage

- `/share`: Used to store the Freenom configuration file. This allows you to easily edit the configuration from outside the app container.
- `/data`: Used internally by the app for persistent storage.

## Support

For issues and feature requests, please use the GitHub repository issues.
