# Changelog

## 1.2.0

- **Host Network Mode**: Enabled `host_network: true` to preserve Source IP addresses in AdGuard Home logs.
- **Configurable Ports**: Ports for DoT and DoH are now fully configurable options in the addon configuration tab (defaults: DoT=853, DoH=3443).
- **Update**: Improved default settings to avoid conflicts with Home Assistant or AdGuard Home.

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
