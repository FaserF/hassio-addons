# Changelog

## 1.0.2 (2026-08-19)

- Manual release via Orchestrator

## 1.0.1 (2026-08-19)

### ✨ Features

- resolve duplicate name key in translations ([`eb3eb0de`](https://github.com/FaserF/hassio-addons/commit/eb3eb0ded96b6d29431b03d3047ec932649c4206))
- add requirements.txt for automated Renovate dependency tracking ([`56aaaa42`](https://github.com/FaserF/hassio-addons/commit/56aaaa42648bca1f7b04a3dbb08c7c5f293ac936))
- resolve translation schema validation, hadolint shell warnings and alpine build dependencies ([`adf2c0b8`](https://github.com/FaserF/hassio-addons/commit/adf2c0b85dbc3a27915a67344edafad3db436546))
- add Google Antigravity Usage monitor addon ([`81495c89`](https://github.com/FaserF/hassio-addons/commit/81495c890a4d15605f44d0ac5c30ff2b85db4dd0))

### 🐛 Bug Fixes

- docker build fixes ([`cbd59e1e`](https://github.com/FaserF/hassio-addons/commit/cbd59e1eb580a004fee7bc6451d76e6a23ec3a49))
- use pre-built Alpine py3 packages to resolve Python 3.14 wheel compilation error ([`c5751137`](https://github.com/FaserF/hassio-addons/commit/c5751137cb00aa5745b2674915cd93f86e912315))

### 📦 Dependencies

- ⬆️ Update Add-on base images ([`cff61763`](https://github.com/FaserF/hassio-addons/commit/cff61763699487bc020cab1735cafd22ebd6f0cf))
- ⬆️ Update dependency uvicorn to v0.52.4 ([`650cd95f`](https://github.com/FaserF/hassio-addons/commit/650cd95f28daf01ea5cf29c61add4f1fab763764))
- update icons and convert logos to official landscape banners ([`e6d061bd`](https://github.com/FaserF/hassio-addons/commit/e6d061bd8292ae6ca473fa21a2e55d5e5f4e70ea))

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
