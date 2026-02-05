# ShieldFile Documentation

ShieldFile provides a modern, fast, and secure way to manage files on your Home Assistant host.

## ⚙️ Configuration

Configure the app via the **Configuration** tab in the Home Assistant App page.

### Options

```yaml
base_directory: /share
certfile: fullchain.pem
keyfile: privkey.pem
log_level: info
port: 8443
users:
  - username: admin
    password: changeme
```

## 📂 Folder Usage

- `/config`: Home Assistant configuration directory.
- `/ssl`: Used for SSL certificates (`certfile` and `keyfile`).
- `/share`: Shared folder between Home Assistant and other apps.
- `/media`: Media folder for storing media files.
- `/backup`: Home Assistant backup directory.
- `/data`: Used internally by the app for persistent meta-data storage.

## Support

For issues and feature requests, please use the GitHub repository issues.
