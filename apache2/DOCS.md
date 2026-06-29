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

## 🔗 URL Rewriting & .htaccess

This addon has Apache's `mod_rewrite` module enabled by default. This allows you to use standard `.htaccess` files in your document root (e.g., `/share/htdocs/`) for URL rewriting, routing, and redirections.

## 🔒 SSL & Local Access Troubleshooting

If you access your website locally using its IP address (e.g., `https://192.168.1.50:8324`), your browser will display an SSL/TLS warning (such as `NET::ERR_CERT_COMMON_NAME_INVALID` or "Your connection is not private").

This is expected behavior. SSL/TLS certificates (like those from Let's Encrypt or DuckDNS) are issued to validate specific domain names, not local IP addresses.

To avoid this issue:

- **For local testing/development**: Set `ssl: false` in the addon configuration and access the site via HTTP on port `80`.
- **For production/remote access**: Access the website using the domain name for which the certificate was issued (e.g., `https://your-domain.duckdns.org:8324`).

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
