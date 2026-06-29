# Apache2 Documentation

A lightweight Apache 2 web server for Home Assistant OS, with optional PHP 8.5 and MariaDB support.

## ⚙️ Configuration

Configure the app via the **Configuration** tab in the Home Assistant App page.

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

- `/share`: Used to store your website files. The default location is `/share/htdocs`. This allows you to easily edit your website files from outside the app container.
- `/ssl`: Used for SSL certificates (`certfile` and `keyfile`). Required if `ssl: true` is enabled.
- `/data`: Used for persistent storage of the MariaDB database and internal configurations.

<!-- PHP_INFO_START -->
## 🐘 PHP Information

**PHP Version**: 8.5

**Available PHP Modules**:
- bcmath
- bz2
- calendar
- ctype
- curl
- dom
- exif
- fileinfo
- ftp
- gd
- gettext
- iconv
- intl
- ldap
- mbstring
- mysqli
- mysqlnd
- pcntl
- pdo
- pdo_mysql
- pdo_sqlite
- pecl-apcu
- pecl-imagick
- pecl-imap
- pecl-redis
- pecl-xdebug
- phar
- posix
- session
- shmop
- simplexml
- soap
- sockets
- sodium
- sqlite3
- sysvmsg
- sysvsem
- sysvshm
- tokenizer
- xml
- xmlreader
- xmlwriter
- zip
<!-- PHP_INFO_END -->

## Support

For issues and feature requests, please use the GitHub repository issues.
