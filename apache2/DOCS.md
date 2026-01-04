# Apache2 Documentation

A lightweight Apache 2 web server for Home Assistant OS, with optional PHP 8 and MariaDB support.

## ⚙️ Configuration

Configure the add-on via the **Configuration** tab in the Home Assistant add-on page.

### Options

```yaml
certfile: fullchain.pem
default_conf: default
default_ssl_conf: default
document_root: /share/htdocs
init_commands: []
keyfile: privkey.pem
php_ini: default
ssl: true
website_name: null
```

## 📂 Folder Usage

- `/share`: Used to store your website files. The default location is `/share/htdocs`. This allows you to easily edit your website files from outside the add-on container.
- `/ssl`: Used for SSL certificates (`certfile` and `keyfile`). Required if `ssl: true` is enabled.
- `/media`: Mapped for general use, e.g., for serving media files from your `/media` folder.
- `/data`: Used for persistent storage of the MariaDB database and internal configurations.

## Support

For issues and feature requests, please use the GitHub repository issues.
