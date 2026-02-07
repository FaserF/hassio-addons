# OpenSSL Documentation

Generate self-signed certificates for Homeassistant OS.

## ⚙️ Configuration

Configure the app via the **Configuration** tab in the Home Assistant App page.

### Options

```yaml
website_name: null
```

## 📂 Folder Usage

- `/ssl`: Used to store the generated self-signed certificates (`key_openssl.pem` and `cert_openssl.pem`). These are placed here so other apps can access and use them.
- `/data`: Used internally by the app for persistent meta-data storage.

## Usage

After starting the App, a self signed certificate will be created and placed to:
`/ssl/key_openssl.pem`
`/ssl/cert_openssl.pem`

These can then be used by other Apps. If the certificates are about to expire, just restart the App once and new certificates will be created.

> [!WARNING]
> After restarting the App, old certificates named as above will be deleted and overwritten!

## Support

For issues and feature requests, please use the GitHub repository issues.
