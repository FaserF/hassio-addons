# Changelog

## 0.1.1-dev-20260822-0927-555dde0 (2026-08-22)

### ✨ Features
- separate crypto vs stocks/etfs metrics and add 12-hour session grace period ([`4fd25e55`](https://github.com/FaserF/hassio-addons/commit/4fd25e55743704f498a3174b631f6120720d1521))

### 🐛 Bug Fixes
- synchronize and unify browser and websocket user agent ([`555dde02`](https://github.com/FaserF/hassio-addons/commit/555dde02df1f5192a424603ac7cead9534ded86c))
- dynamically link is_logged_in to ws_keeper status and prevent false unauth in UI ([`3b3ad199`](https://github.com/FaserF/hassio-addons/commit/3b3ad199e3658093f8df4a28f988c06108fef966))
- align WS upgrade headers to cookies-only first to prevent 401 on restart ([`a62e37bb`](https://github.com/FaserF/hassio-addons/commit/a62e37bb915830479acbb0a73e21bd2b5e771a3b))
- accept all valid handshake response patterns from TR WS endpoint ([`05c46293`](https://github.com/FaserF/hassio-addons/commit/05c462934795857d53e0a4f285e9a17a7465c875))
- prevent session loss on container restart by injecting cookies prior to page load ([`905dddc0`](https://github.com/FaserF/hassio-addons/commit/905dddc0c255145873f907c1756ec3920c2cd970))
- improve handshake error diagnostics on 401 response ([`c2aed244`](https://github.com/FaserF/hassio-addons/commit/c2aed244bff323ce9a862e44922d16cea74622e1))
- prevent false-positive login confirmation and verify token strictly ([`5a4b7e44`](https://github.com/FaserF/hassio-addons/commit/5a4b7e44ada553fab27f150535b1f43de747c471))

### 📦 Dependencies
- update project manifests and format files ([`7d601d44`](https://github.com/FaserF/hassio-addons/commit/7d601d447c535d79e3f3f944726a5f11fe424d58))

### 🚀 Other
- Make cache retention duration configurable in Trade Republic add-on ([`23a7cdc1`](https://github.com/FaserF/hassio-addons/commit/23a7cdc164d14955d0f58aada653ecc64810e3d8))
- Standardize log_level configuration and handling across all add-ons ([`7ddda206`](https://github.com/FaserF/hassio-addons/commit/7ddda206529ef9453a58d36af03969ed975a8e66))


## 0.1.0 (Initial Release)

- Initial release of Trade Republic Headless Browser session provider add-on.
- Built-in Ingress UI for 2FA login.
- Playwright Chromium engine for AWS WAF challenge bypass.
- REST API endpoint for integration token discovery.
