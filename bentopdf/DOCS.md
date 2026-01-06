# BentoPDF Documentation

BentoPDF for Home Assistant OS

A privacy-first, client-side PDF toolkit that processes files locally in your browser.

**⚠️ Important:** This is the Beta version of the BentoPDF add-on.

## ⚙️ Configuration

Configure the add-on via the **Configuration** tab in the Home Assistant add-on page.

### Options

```yaml
ssl: false
certfile: fullchain.pem
keyfile: privkey.pem
```

## 📂 Folder Usage

- `/ssl`: Used for SSL certificates (`certfile` and `keyfile`). Required if `ssl: true` is enabled.

## Networking

- **Port 8035**: The Web Interface is exposed on this port.
- **Ingress**: Supported and recommended for secure access via Home Assistant.

## Support

For issues and feature requests, please use the GitHub repository issues.
