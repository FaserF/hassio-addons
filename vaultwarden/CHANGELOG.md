# Changelog


## [0.1.0] - 2026-01-27

### Added

- Initial release of the Vaultwarden (Bitwarden) (Custom) add-on in this repo
- Support for Ingress for seamless UI integration.
- Support for direct port access (default 7277).
- SSL/TLS support for direct access.
- Essential configuration options via Home Assistant UI:
  - Logging level for troubleshooting.
  - SSL certificate and key file selection.
  - API request size limit customization.
- Automatic updates via Renovate to track Vaultwarden releases.
- Hardened SSL parameters for Nginx.
- Healthcheck functionality to monitor add-on status.
- Support for all internal Vaultwarden settings via the Vaultwarden Admin Panel.
