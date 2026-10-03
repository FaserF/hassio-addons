# Changelog

## 0.1.3-dev-20261003-1617-72cb111 (2026-10-03)

### ✨ Features
- --headless not =new for Alpine, log chromium stderr, extra wait 3s after navigation, log URL+title+body on load; feat: /api/debug/chromium-log endpoint ([`cc9c3cab`](https://github.com/FaserF/hassio-addons/commit/cc9c3cab9c8e89045af640d9b55a469bcf48a776))
- add headless Chromium CDP automation for seamless 2FA login ([`ebf58d11`](https://github.com/FaserF/hassio-addons/commit/ebf58d113a0e50d0c59bd379af125e106586dab8))
- add custom themed 2FA modal dialogs, error explanations, and toasts ([`23a872cc`](https://github.com/FaserF/hassio-addons/commit/23a872cc31537a9ce813ebe1767d5c54f0adb068))

### 🐛 Bug Fixes
- use https://accounts.google.com/EmbeddedSetup without non-existing /identifier path ([`48e58eef`](https://github.com/FaserF/hassio-addons/commit/48e58eefd4dd07b3f78966b87cbf5c58fe4e5ff0))
- unwrap nested CDP Runtime.evaluate result structure ([`f312de7c`](https://github.com/FaserF/hassio-addons/commit/f312de7c28f428bdbd8e40ba64597a901efb2c02))
- support websockets 14+ State.OPEN check instead of .closed attribute ([`6af70995`](https://github.com/FaserF/hassio-addons/commit/6af709958348946305eb64347e49ce0d0021af27))
- persistent WebSocket connection with reconnect after navigation, Runtime.enable before evaluate calls - fixes 'value: None' on all CDP responses ([`00fc3f14`](https://github.com/FaserF/hassio-addons/commit/00fc3f1495347b047a010defea78df4a515b2571))
- service name 'googlehome' -> 'google_home' to match integration domain ([`b7980270`](https://github.com/FaserF/hassio-addons/commit/b7980270de39962342ba9133d9c5920c338594b2))
- clean rewrite - EmbeddedSetup URL, Weiter-click for pre-selected screens, proper readyState wait, native input setter ([`5dae2574`](https://github.com/FaserF/hassio-addons/commit/5dae257403e07b483cda5f189a2f37fe5cf20379))
- fix advanced token entry toggle visibility and default state ([`019099e1`](https://github.com/FaserF/hassio-addons/commit/019099e1db09cb8327b0440efcaa199529a40b19))

### 🔧 Configuration
- move googlehome to .dev/ so it is only available in edge channel ([`72cb111c`](https://github.com/FaserF/hassio-addons/commit/72cb111c7639217b9b33a77a5c4faae84d7c3843))


## 0.1.2

- Add live progress stepper and loading indicator for Google Find My E2EE Shared Key extraction
- Add `/api/findmy/extract-status` endpoint for polling extraction stages
- Detect and report Google password / screen-lock security challenge during auto-extraction
- Fix token parameter passing during automated background extraction callback

## 0.1.1

- Fix Find My E2EE key auto-extraction: sign headless browser in via master token (works without prior Google Home browser login)
- Register unlock-page JS bridge before page load so the vault key callback is no longer missed
- Add diagnostic warnings when extraction fails

## 0.1.0

- Initial release of Google Home Token Hub Add-on.
