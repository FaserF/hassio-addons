# Apache2 Documentation

A lightweight Apache 2 web server for Home Assistant OS, with optional PHP 8.5 and MariaDB support.

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
- `/data`: Used for persistent storage of the MariaDB database and internal configurations.

<!-- PHP_INFO_START -->
## 🐘 PHP Information

**PHP Version**: 8.5

**Available PHP Modules**:
- apcu
- ctype
- curl
- dom
- exif
- fileinfo
- gd
- iconv
- imap
- intl
- json
- mbstring
- mysqli
- opcache
- pdo
- pdo_mysql
- pdo_sqlite
- phar
- session
- simplexml
- soap
- sockets
- tokenizer
- xml
- xmlwriter
- zip
<!-- PHP_INFO_END -->

## Support

For issues and feature requests, please use the GitHub repository issues.
