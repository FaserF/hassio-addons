# Changelog

## 1.0.0 (2026-08-24)

### ✨ Features
- pre-rotate session token in headless Chromium on startup to ensure restart persistence ([`4bae7c57`](https://github.com/FaserF/hassio-addons/commit/4bae7c5786aec372c2b1ac3f3c142143b9b0a52b))
- add localized info tooltips for all metrics and status fields ([`d3926aaf`](https://github.com/FaserF/hassio-addons/commit/d3926aafc396d049d9d259489a2ff4eae1343e9e))
- auto-renew web JWT session cookies via background Chromium navigation ([`5e8431ae`](https://github.com/FaserF/hassio-addons/commit/5e8431aece19f3ea8bba9c40a6781080f7eae88b))
- add interactive web sign-in and remove hardcoded credentials ([`ec6caba8`](https://github.com/FaserF/hassio-addons/commit/ec6caba82ccbd3c8b6a1529a81a145563c691c44))
- correctly format logged out since duration in UI and add i18n support ([`6fa17ab5`](https://github.com/FaserF/hassio-addons/commit/6fa17ab5fbd6c36eaf1cfb115e1d58c401b43f52))
- add session uptime tracking, disconnect reason, and auto-retry on reconnect ([`7659fc89`](https://github.com/FaserF/hassio-addons/commit/7659fc891c69297c2c484bf39465596afe3c2e6c))
- add prominent note about restart session invalidation in Web UI and i18n ([`c17a259a`](https://github.com/FaserF/hassio-addons/commit/c17a259afdec090b70e566eb92ab1bda22f5c41b))
- add periodic active category subscription refresh loop to keep data fresh ([`52b8ea75`](https://github.com/FaserF/hassio-addons/commit/52b8ea75206f38ea32c6daf170a9ae322940dc3c))
- synchronize and extract refreshed tokens from browser on startup before connecting ws keeper ([`15c48e44`](https://github.com/FaserF/hassio-addons/commit/15c48e4451ba56e0f89c5f9108d5d888dabcaf44))

### 🐛 Bug Fixes
- modernize dashboard metrics layout and fix login timestamp reset ([`b2286d44`](https://github.com/FaserF/hassio-addons/commit/b2286d44dd455d679bd3e7b8fe5ac9ec06688c2b))
- include authorization bearer header in primary websocket handshake ([`994027c9`](https://github.com/FaserF/hassio-addons/commit/994027c923ff9077a5d1f8db563600ad47c6b01c))
- update last_token_update_time when keepalive confirms active session ([`b127c631`](https://github.com/FaserF/hassio-addons/commit/b127c631e76f5a139e0ad365d9326f700f75bedf))
- fix javascript syntax error in index.html toggleRelogin ([`171d4e9f`](https://github.com/FaserF/hassio-addons/commit/171d4e9f8625dcd5b248a3ed09e914e607af9151))
- restore 2FA view on UI reload and enhance form submission for phone approval ([`fdc488e5`](https://github.com/FaserF/hassio-addons/commit/fdc488e502c4e077b7b82481fa9533ccb12b336f))
- prevent false positive connected status on startup before keeper authenticates ([`49e83dd1`](https://github.com/FaserF/hassio-addons/commit/49e83dd168b6e8e12fbb121e57a1a949e1293349))
- preserve previous session duration and logout time across restarts ([`966dae0c`](https://github.com/FaserF/hassio-addons/commit/966dae0c4a178fe98c3dcb8debbb45c30e05152e))
- fix try-except indentation and block scoping in ws_keeper _connect ([`6606a91a`](https://github.com/FaserF/hassio-addons/commit/6606a91a03f195063989ece64b3c4cc62787a196))
- verify extracted browser cookies before updating session and restart keeper ([`535216c7`](https://github.com/FaserF/hassio-addons/commit/535216c70b2bb92d775ab2b43a7816469f9d7e25))
- synchronize and unify browser and websocket user agent ([`555dde02`](https://github.com/FaserF/hassio-addons/commit/555dde02df1f5192a424603ac7cead9534ded86c))
- dynamically link is_logged_in to ws_keeper status and prevent false unauth in UI ([`3b3ad199`](https://github.com/FaserF/hassio-addons/commit/3b3ad199e3658093f8df4a28f988c06108fef966))
- align WS upgrade headers to cookies-only first to prevent 401 on restart ([`a62e37bb`](https://github.com/FaserF/hassio-addons/commit/a62e37bb915830479acbb0a73e21bd2b5e771a3b))

### 📦 Dependencies
- update project manifests and format files ([`7d601d44`](https://github.com/FaserF/hassio-addons/commit/7d601d447c535d79e3f3f944726a5f11fe424d58))

### 🚀 Other
- Make cache retention duration configurable in Trade Republic add-on ([`23a7cdc1`](https://github.com/FaserF/hassio-addons/commit/23a7cdc164d14955d0f58aada653ecc64810e3d8))

### 📌 Release Note
- Initial stable release


## 0.1.0 (Initial Release)

- Initial release of Trade Republic Headless Browser session provider add-on.
- Built-in Ingress UI for 2FA login.
- Playwright Chromium engine for AWS WAF challenge bypass.
- REST API endpoint for integration token discovery.
