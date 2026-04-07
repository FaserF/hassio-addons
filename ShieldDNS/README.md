# ShieldDNS

<img src="https://raw.githubusercontent.com/FaserF/hassio-addons/master/ShieldDNS/logo.png" width="100" alt="Logo" />

[![Open your Home Assistant instance and show the app dashboard.](https://my.home-assistant.io/badges/supervisor_addon.svg)](https://my.home-assistant.io/redirect/supervisor_addon/?addon=c1e285b7_ShieldDNS)
[![Home Assistant App](https://img.shields.io/badge/home%20assistant-app-blue.svg)](https://www.home-assistant.io/apps/)
[![Docker Image](https://img.shields.io/badge/docker-2.4.0-blue.svg?logo=docker&style=flat-square)](https://github.com/FaserF/hassio-addons/pkgs/container/hassio-addons-shielddns)
![Project Maintenance](https://img.shields.io/badge/maintainer-FaserF-blue?style=flat-square)

> High-performance DoT proxy for AdGuard Home

---

## 📖 About

**ShieldDNS** is a high-performance, privacy-focused DNS solution supporting both **DNS-over-TLS (DoT)** and **DNS-over-HTTPS (DoH)**.

It features a premium **Admin Dashboard** for real-time monitoring and a powerful **Filtering Engine** compatible with AdGuard, Pi-hole, and uBlock origin lists.

## 🚀 Key Features

- 🔒 **Full Dual Support**: Natively supports both **DNS-over-TLS (DoT)** (port 853) and **DNS-over-HTTPS (DoH)** (port 443) with high-efficiency processing.
- 📊 **Admin Dashboard**: Premium web UI for real-time statistics and configuration.
- 🛡️ **DNS Filtering**: Integrated engine for blocklists with automatic updates and deduplication.
- ⚡ **High Performance**: Built on CoreDNS and Go for maximum efficiency.
- 🔐 **Secure Access**: Mandatory password protection (bcrypt) for the Admin UI.
- 📱 **Multi-Platform**: Perfect for Android Private DNS, iOS Profiles, and Windows 11.

## 🛠️ Usage

### Docker Compose

```yaml
services:
  shielddns:
    image: ghcr.io/faserf/shielddns:latest
    ports:
      - '853:853/tcp' # DoT
      - '443:443/tcp' # DoH
      - '8080:8080/tcp' # Admin Dashboard
    environment:
      - UPSTREAM_DNS=1.1.1.1, 8.8.8.8
      - LOG_LEVEL=info # debug, info, error
      - CERT_FILE=/certs/fullchain.pem
      - KEY_FILE=/certs/privkey.pem
    volumes:
      - ./certs:/certs
      - ./data:/etc/shielddns # Persistent config and stats
```

## 🖥️ Admin Dashboard

Access the dashboard at `http://YOUR_SERVER_IP:8080`.

- **Initial Setup**: On first access, you will be prompted to set a 12-character administrative password.
- **Filtering**: Manage your blocklists (AdGuard, Pi-hole, etc.) directly from the UI.
- **Stats**: View total queries, blocked requests, and blocking ratio in real-time.

## 📱 Client Configuration

### DoT (DNS-over-TLS) - Port 853

- **Android**: Go to **Settings > Network > Private DNS** and enter `dns.example.com`.
- **iOS/macOS**: Use the provided `.mobileconfig` template.

### DoH (DNS-over-HTTPS) - Port 443

- **Windows 11**: **Settings > Network > DNS settings > Edit**. Set DNS over HTTPS to "On (Manual)" and enter `https://dns.example.com/dns-query`.
- **Browsers**: Enter `https://dns.example.com/dns-query` in your browser's "Secure DNS" settings.

## 🛡️ Security Best Practices

Since you are exposing a DNS server to the public, you should secure it:

1. **Use a WAF**: Place a Reverse Proxy or Cloudflare Tunnel in front of your DoH endpoint.
2. **Firewall**: Whitelist your mobile IP ranges for port 853 if possible.
3. **Password**: Use a strong, unique password for the Admin UI (min 12 chars).

## 💡 Concepts & Protocols

| Protocol | Port  | Description                | Support                                 |
| :------- | :---- | :------------------------- | :-------------------------------------- |
| **DoT**  | `853` | Dedicated secure DNS port. | **Native** (Android Private DNS).       |
| **DoH**  | `443` | Standard HTTPS web port.   | **Native** (Windows 11, iOS, Browsers). |

## 🏠 Home Assistant Addon

ShieldDNS is available as an official Home Assistant Addon, featuring full **Ingress** support for the Admin Dashboard.
[View Addon Repo](https://github.com/FaserF/hassio-addons/tree/master/ShieldDNS)

---

## ⚙️ Configuration

Configure the app via the **Configuration** tab in the Home Assistant App page.

### Options

```yaml
certfile: fullchain.pem
doh_port: 443
dot_port: 8853
fallback_dns: false
fallback_dns_server: 1.1.1.1
keyfile: privkey.pem
log_level: info
prefer_encrypted: true
upstream_dns: 86.54.11.100 1.1.1.1 9.9.9.9 8.8.8.8 1.0.0.1
upstream_dot: unfiltered.joindns4.eu dns.quad9.net one.one.one.one dns.google
```

---

## 👨‍💻 Credits & License

This project is open-source and available under the MIT License.
Maintained by **FaserF**.
