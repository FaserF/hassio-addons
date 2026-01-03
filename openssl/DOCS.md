# OpenSSL Documentation

Generate self-signed certificates for Homeassistant OS.

## ⚙️ Configuration

Configure the add-on via the **Configuration** tab in the Home Assistant add-on page.

### Options

```yaml
website_name: null
```

## 📂 Folder Usage

- `/ssl`: Used to store the generated self-signed certificates (`key_openssl.pem` and `cert_openssl.pem`). These are placed here so other add-ons can access and use them.
- `/data`: Used internally by the add-on for persistent meta-data storage.

## Usage

After starting the addon, a self signed certificate will be created and placed to:
`/ssl/key_openssl.pem`
`/ssl/cert_openssl.pem`

These can then be used by other addons. If the certificates are about to expire, just restart the addon once and new certificates will be created.

> [!WARNING]
> After restarting the addon, old certificates named as above will be deleted and overwritten!

## Support

For issues and feature requests, please use the GitHub repository issues.
