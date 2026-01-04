# ShieldDNS Documentation

ShieldDNS is a high-performance DoT proxy for AdGuard Home.

## ⚙️ Configuration

Configure the add-on via the **Configuration** tab in the Home Assistant add-on page.

### Options

```yaml
certfile: fullchain.pem
cloudflare_tunnel_token: ''
doh_port: 3443
dot_port: 8853
enable_info_page: false
fallback_dns: false
fallback_dns_server: 1.1.1.1
keyfile: privkey.pem
log_level: info
upstream_dns: 192.168.1.2
```

## 📂 Folder Usage

- `/ssl`: Used for SSL certificates (`certfile` and `keyfile`).
- `/config`: Home Assistant configuration directory (mapped but not used by the add-on directly).
- `/data`: Used internally by the add-on for persistent storage.

## Support

For issues and feature requests, please use the GitHub repository issues.
