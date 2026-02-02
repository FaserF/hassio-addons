# Apache2 Minimal with MariaDB Client Documentation

Open Source Webserver with MariaDB Client and some PHP Modules.

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
- `/data`: Used internally by the add-on for persistent storage.

<!-- PHP_INFO_START -->
## 🐘 PHP Information

**PHP Version**: 8.5

**Available PHP Modules**:
- curl
- mbstring
- mysqli
- zip
<!-- PHP_INFO_END -->

## Support

For issues and feature requests, please use the GitHub repository issues.
