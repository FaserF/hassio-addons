# ShieldDNS Documentation

ShieldDNS is a high-performance DNS solution for **DNS-over-TLS (DoT)** and **DNS-over-HTTPS (DoH)**.

## 🖥️ Admin Dashboard & Ingress

ShieldDNS features a premium Admin Dashboard available directly via **Home Assistant Ingress**.
- **Access**: Click "Open Web UI" on the addon page.
- **Initial Setup**: On your first visit, you must set a password (min 12 characters).
- **Features**: Real-time query stats, blocklist management, and upstream configuration.

## ⚙️ Configuration

Initial setup is done via the **Configuration** tab in Home Assistant.

### Options

- `upstream_dns`: The DNS servers to forward queries to (e.g., `1.1.1.1, 8.8.8.8`).
- `certfile` / `keyfile`: Your SSL certificate files located in the `/ssl` folder.
- `dot_port`: Port for DNS-over-TLS (Default: `8853`).
- `doh_port`: Port for DNS-over-HTTPS (Default: `3443`).
- `log_level`: Level of detail in the addon logs.

## 📱 Protocol Setup

### DoT (DNS-over-TLS)
To use DoT on Android (Private DNS), you typically need to map your WAN port `853` to the internal `dot_port` (e.g., `8853`) in your router.
- **Hostname**: `dns.yourdomain.com`

### DoH (DNS-over-HTTPS)
For Windows 11 or Brousers, use the DoH endpoint.
- **URL**: `https://dns.yourdomain.com/dns-query` (ensure port `443` is forwarded to `doh_port`).

## 📂 Folder Usage

- `/ssl`: Used for SSL certificates.
- `/data`: Used internally for persistent configuration and blocklists.

## Support

For issues and feature requests, please use the GitHub repository issues.
