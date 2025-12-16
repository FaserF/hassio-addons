# Changelog

## 1.2.0
- **Host Network Mode**: Enabled `host_network: true` to preserve Source IP addresses.
- **Configurable Ports**: All ports (`dot_port`, `doh_port`, etc.) are now configurable options.
- **Refined Defaults**:
    - DoT Port default changed to `8853` to avoid AdGuard Home conflict (Port 853).
    - Alt DoH Ports (784, 2443) are now **disabled by default** (Optional).
- **Translations**: Added English and German configuration descriptions.

## 1.1.0
- **DoH Support** added on ports 443 (default mapped to 3443), 784, and 2443
- **Official Cloudflare Tunnel Addon** support added (via documentation)
- **New Logo** added to add-on icon and documentation
- **Configuration**: `cloudflare_tunnel_token` is now optional
- **Configuration**: Default HTTPS port mapping changed to `3443` to avoid conflicts
- **Docs**: Improved documentation on AdGuard Home compatibility and Client Setup

## 1.0.0
- Initial Release
- Support for DNS-over-TLS (DoT)
- Support for Cloudflare Tunnel
- Support for AdGuard Home Integration
