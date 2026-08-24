# Changelog

## 1.0.1-dev-20260824-2009-fdf7b78 (2026-08-24)

### ✨ Features
- link version pills to their respective GitHub repositories ([`15b1896a2`](https://github.com/FaserF/hassio-addons/commit/15b1896a27e4586ba8a7de68707b2dcfd9761bcc))
- display local add-on and integration versions in UI footer ([`ad91e7ab5`](https://github.com/FaserF/hassio-addons/commit/ad91e7ab56c5c97bd3aafc04565f9354942d7965))

### 🐛 Bug Fixes
- eliminate duplicate alert blocks and standardize README notice cleaning ([`fdf7b787f`](https://github.com/FaserF/hassio-addons/commit/fdf7b787f1450d3e372795a968a68b6b721181a4))
- prevent session drop by shortening keepalive to 120s and auto-rotating tokens via Chromium on WebSocket 401 ([`e66900258`](https://github.com/FaserF/hassio-addons/commit/e66900258350fa7767f7c15dcaeaf5025425c323))
- auto-recover fresh session token from Chromium on WebSocket 401 disconnect ([`e120c41a7`](https://github.com/FaserF/hassio-addons/commit/e120c41a7fbd53a0d6f46e4ece160b9bdf34316d))
- resolve Jinja2 TemplateSyntaxError in script block and fix ws_keeper exceptions ([`a2aad06f3`](https://github.com/FaserF/hassio-addons/commit/a2aad06f3bed2925c26f7edfb83eabe16f8ebffc))
- move versions to clean footer, fix header layout wrap ([`2541f08b4`](https://github.com/FaserF/hassio-addons/commit/2541f08b41c4191ce33757aa1b489dda6c55d636))
- dynamically inject supervisor add-on version into s6 runtime environment ([`5761c2475`](https://github.com/FaserF/hassio-addons/commit/5761c2475889f1be7dc1a8f72bbe5c1fda8fee60))
- resolve dynamic add-on version via supervisor API, format version tags ([`bfe0d66f2`](https://github.com/FaserF/hassio-addons/commit/bfe0d66f2cfe941cc9f53fa262b8a6082a26bd30))
- restore missing step-login opening tags and remove duplicate footer versions ([`acaa8a66c`](https://github.com/FaserF/hassio-addons/commit/acaa8a66c3c4867162a60d9670d3da4723bab886))
- restrict phone/pin input types, improve restart notification ([`dd594a6cb`](https://github.com/FaserF/hassio-addons/commit/dd594a6cbbdc5a93df23c1cafa67a7be261dc7f5))


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
- fix try-except indentation and block scoping in ws_keeper_connect ([`6606a91a`](https://github.com/FaserF/hassio-addons/commit/6606a91a03f195063989ece64b3c4cc62787a196))
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
