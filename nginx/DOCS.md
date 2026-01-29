# NGINX Documentation

A lightweight NGINX web server for Home Assistant OS, with PHP 8.5 and MariaDB support.

## ⚙️ Configuration

Configure the add-on via the **Configuration** tab in the Home Assistant add-on page.

### Port Configuration

By default, HTTPS is mapped to external port **8324** instead of the standard port 443. This avoids conflicts with other services that may use port 443. When accessing your website via HTTPS, use the mapped port (e.g., `https://your-ip:8324`).

### SSL/HTTPS Configuration

> **⚠️ Important**: SSL is **disabled by default** (`ssl: false`) to allow the add-on to start without pre-existing certificates.

**To enable SSL/HTTPS:**

1. **Place your SSL certificates** in the `/ssl` directory:
   - Certificate file: `/ssl/fullchain.pem` (default, or specify custom filename)
   - Private key file: `/ssl/privkey.pem` (default, or specify custom filename)

2. **Update the configuration**:

   ```yaml
   ssl: true
   certfile: fullchain.pem
   keyfile: privkey.pem
   ```

3. **Restart the add-on** to apply the changes.

**Important Notes:**

- The add-on will **fail to start** if `ssl: true` is set but the certificate files are missing.
- Ensure certificates are in place **before** enabling SSL.
- The `certfile` and `keyfile` options are only used when `ssl: true`.

### Options

```yaml
certfile: fullchain.pem
default_conf: default
default_ssl_conf: default
document_root: /share/htdocs
init_commands: []
keyfile: privkey.pem
php_ini: default
ssl: false
website_name: null
```

## 📂 Folder Usage

- `/share`: Used to store your website files. The default location is `/share/htdocs`. This allows you to easily edit your website files from outside the add-on container.
- `/ssl`: Used for SSL certificates (`certfile` and `keyfile`). **Required** if `ssl: true` is enabled. Place your certificate files here before enabling SSL.
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
