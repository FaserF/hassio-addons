# ShieldDNS

![Logo](logo.png)

[![Open your Home Assistant instance and show the add-on dashboard.](https://my.home-assistant.io/badges/supervisor_addon.svg)](https://my.home-assistant.io/redirect/supervisor_addon/?addon=c1e285b7_ShieldDNS)
[![Home Assistant Add-on](https://img.shields.io/badge/home%20assistant-addon-blue.svg)](https://www.home-assistant.io/addons/)
[![GitHub Release](https://img.shields.io/github/v/release/FaserF/hassio-addons?include_prereleases&style=flat-square)](https://github.com/FaserF/hassio-addons/releases)
![Project Maintenance](https://img.shields.io/badge/maintainer-FaserF-blue?style=flat-square)

> High-performance DoT proxy for AdGuard Home

---

## 📖 About

<!-- markdownlint-disable MD033 MD041 MD013 -->
<!-- markdownlint-enable MD033 MD041 -->

mobile devices and forward them to your local AdGuard Home or other DNS
servers. This secures your DNS queries even when you are on your local network
(if your device enforces Private DNS) or if you expose this port securely.

---

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

---

## 👨‍💻 Credits & License

This project is open-source and available under the MIT License.
Maintained by **FaserF**.
