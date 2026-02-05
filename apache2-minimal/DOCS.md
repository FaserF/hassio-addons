# Apache2 Minimal Documentation

Open Source Webserver without PHP and minimal extra modules.

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
ssl: true
website_name: null
```

## 📂 Folder Usage

- `/share`: Used to store your website files. The default location is `/share/htdocs`. This allows you to easily edit your website files from outside the app container.
- `/ssl`: Used for SSL certificates (`certfile` and `keyfile`). Required if `ssl: true` is enabled.
- `/data`: Used internally by the app for persistent storage.

## Support

For issues and feature requests, please use the GitHub repository issues.
