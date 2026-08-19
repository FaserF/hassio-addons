# Changelog

## 1.0.1 (2026-08-19)

### 🐛 Bug Fixes
- reset all 28 addons to pre-release base versions and clean changelogs ([`e1ff3f48`](https://github.com/FaserF/hassio-addons/commit/e1ff3f489b5e1b95a4bb57eeb33a19d39c3b67d3))


All notable changes to the Google Antigravity Home Assistant Add-on will be documented in this file.

## [1.0.0] - 2026-08-18

### Added

- Initial release of the Google Antigravity Home Assistant Addon.
- Full support for multi-account OAuth credentials with refresh token management.
- Dynamic & Adaptive Polling engine (configurable base scan, 3m fast poll upon detected activity, 60m idle backoff).
- Ingress Single-Page Dark Theme Web UI matching developer aesthetics.
- Circular gauges for 5-hour rolling limits and weekly quota limits with reset countdowns.
- Credit status and plan tier tracking.
- Interactive in-app Setup Guide and credential verification tool.
- REST API endpoints (`/api/status`, `/api/accounts`, `/api/refresh`, `/api/test-credentials`, `/healthz`).
- s6-overlay v3 process supervision and container initialization.
