# Changelog

## 0.3.1 (2026-04-09)

### ✨ Features
- New HA Integration for Apache2 & NGINX ([`168b816f`](https://github.com/FaserF/hassio-addons/commit/168b816f5804531e5d7c94eaf4027c422f6771c3))

### 🐛 Bug Fixes
- robust ingress auth and restore /apps/ links ([`1ec04eb3`](https://github.com/FaserF/hassio-addons/commit/1ec04eb3bebea8dcbf983d9d6340d303be6af7d7))
- resolve link validation 404s and typos ([`5c06b173`](https://github.com/FaserF/hassio-addons/commit/5c06b17353ff711a1c9f526ac51f4f8631c76007))

### 📦 Dependencies
- ⬆️ Update Add-on base images [skip-tests] (#713) ([`9e108e8f`](https://github.com/FaserF/hassio-addons/commit/9e108e8f57386150d955808ab69abf14fca64c0e))
- update home-assistant.io/addons/ to /apps/ and remove ignore ([`35318ec8`](https://github.com/FaserF/hassio-addons/commit/35318ec8f6d1c5be470aace8f13a1ac617fd9b85))
- Update README information with support info ([`c70fff01`](https://github.com/FaserF/hassio-addons/commit/c70fff01378d531e3dffc35dc2bf94b49237f541))

### 🚀 Other
- fix HA list usage ([`e4636cd1`](https://github.com/FaserF/hassio-addons/commit/e4636cd1b2a8e60b1a3c23523b8d08a1a22c24b2))
- HA list interpretation fixes ([`4159d335`](https://github.com/FaserF/hassio-addons/commit/4159d33573e37cd633c097935a3efa47c84f1728))
- app version injection improvements ([`63580a20`](https://github.com/FaserF/hassio-addons/commit/63580a201a16724ac7712b1ed52c4f195ab05fe4))
- use docker WORKDIR ([`928d223a`](https://github.com/FaserF/hassio-addons/commit/928d223a27fbdae3e6e0db8a5d37ef13416e6d6b))
- CI & building fixes ([`9073d6ca`](https://github.com/FaserF/hassio-addons/commit/9073d6cad25ac37bbb8c1373b3fc016ed26b3fd7))
- Add stage tags ([`75528e61`](https://github.com/FaserF/hassio-addons/commit/75528e6193a0ce55537d2f89fe6069a703f7da88))
- Webserver Integration improvements ([`3fb4a0e6`](https://github.com/FaserF/hassio-addons/commit/3fb4a0e6b86829f056f3c74fdc0127c314afa674))
- fix integration deployment ([`e27dd2c5`](https://github.com/FaserF/hassio-addons/commit/e27dd2c59c529886d7aa4513010aebf66c9c9815))
- track apache2 releases ([`d41941f4`](https://github.com/FaserF/hassio-addons/commit/d41941f47d91bc8b82fb3c2ab94f142d3bc99fe8))
- fixes for new webserver integration ([`5e1439dd`](https://github.com/FaserF/hassio-addons/commit/5e1439dd399069225f4dcbcc9494000134b8efe0))
- app code quality improvements ([`f25fbc72`](https://github.com/FaserF/hassio-addons/commit/f25fbc72ebd57406b16f106c94497e3510ac6bff))
- more small linter improvements ([`c1c2a452`](https://github.com/FaserF/hassio-addons/commit/c1c2a4528971f3fdc96892b37f5f6af6ae246c43))
- linter fixes & improved default app banner ([`19bc94d9`](https://github.com/FaserF/hassio-addons/commit/19bc94d9e306bb9f425a2a96bbb94dc47809cead))
- security & docs improvements codeql ([`a4a06f09`](https://github.com/FaserF/hassio-addons/commit/a4a06f09bab3956a81fe1dc81bf3ce991e3c83d1))
- small fixes & linter improvements ([`33150324`](https://github.com/FaserF/hassio-addons/commit/331503241aa11ccfb398a6cbf5b850aeec084ef2))


## 0.3.0 (2026-01-29)

### 📦 Dependencies

- fix App startups after base image update 20.0.0 (#617) [skip-tests] ([`04c90f6d`](https://github.com/FaserF/hassio-addons/commit/04c90f6d2ea1a75af00b8f6d80ed170271f144d1))
- ⬆️ Update ghcr.io/hassio-addons/base Docker tag to v[20.0.1](https://github.com/hassio-addons/app-base/releases/tag/v20.0.1) [skip-tests] (#618) ([`62a7ed57`](https://github.com/FaserF/hassio-addons/commit/62a7ed5794451961add1f8ec065f5cbe863d1623))
- ⬆️ Update ghcr.io/hassio-addons/base Docker tag to v20 [skip-tests] (#616) ([`09e8340b`](https://github.com/FaserF/hassio-addons/commit/09e8340b06c4263037fab6cf6d90fc913c7f99d5))

### 📝 Documentation

- Readme improvements ([`8a12ebd4`](https://github.com/FaserF/hassio-addons/commit/8a12ebd40149adb39f056b7dc3e10f1dd02853cb))

### 🚀 Other

- fix log level var ([`7f85096a`](https://github.com/FaserF/hassio-addons/commit/7f85096a73b11ea48fa87150def32425ea1e4807))
- standardized log level handling between Apps ([`cf4bc264`](https://github.com/FaserF/hassio-addons/commit/cf4bc264edca7956fb4ae13ae76b22c8c5afafac))

## 0.2.1 (2026-01-14)

### 🚀 Other

- fixed logo in Homeassistant App UI ([`f053f7b0`](https://github.com/FaserF/hassio-addons/commit/f053f7b0b0c43df32e122ba054ba6118379ab959))
- small fixes & improvements ([`ce7a62e4`](https://github.com/FaserF/hassio-addons/commit/ce7a62e43eb50c87458588df6581b8ed3a741c9d))
- New/improved log level option ([`73d8e254`](https://github.com/FaserF/hassio-addons/commit/73d8e254b10e01aaffc474d22192d2b8deea4c79))
- small fixes ([`60c5ddf4`](https://github.com/FaserF/hassio-addons/commit/60c5ddf4fede8242031082aa8e7fa0d057c0087f))

## 0.2.0 (2026-01-11)

### 🎨 Style

- auto-fix (shfmt,black,isort,prettier,markdownlint) ([`1838d16f`](https://github.com/FaserF/hassio-addons/commit/1838d16fd800bde467c70b033ad03e9e600e2891))
- auto-fix (shfmt,black,isort,prettier,markdownlint) ([`cdc7143c`](https://github.com/FaserF/hassio-addons/commit/cdc7143ca2531fdf41778e43e852faee4cd49880))

### 🚀 Other

- more CI fixes & App db reset improvements ([`fc27cc3b`](https://github.com/FaserF/hassio-addons/commit/fc27cc3bee4a9a34fd573f38e870ff921b3f7d3d))
- CI fixes ([`4e31bcdc`](https://github.com/FaserF/hassio-addons/commit/4e31bcdc3025f30797b5ce1f0b220d06b22db35f))
- New/improved log level option ([`73d8e254`](https://github.com/FaserF/hassio-addons/commit/73d8e254b10e01aaffc474d22192d2b8deea4c79))

### 📌 Release Note

- new db reset option & log level improved/added

## 0.1.5 (2026-01-10)

### 🎨 Style

- auto-fix (shfmt,black,isort,prettier,markdownlint) ([`b8c86b04`](https://github.com/FaserF/hassio-addons/commit/b8c86b04f6c1aa1763bf7c7c57072bd2b7591b10))

### 🚀 Other

- small fixes ([`60c5ddf4`](https://github.com/FaserF/hassio-addons/commit/60c5ddf4fede8242031082aa8e7fa0d057c0087f))

### 📌 Release Note

- general background fixes and stability improvements

## 0.1.4 (2026-01-10)

### 🎨 Style

- auto-fix (shfmt,black,isort,prettier,markdownlint) ([`c22433eb`](https://github.com/FaserF/hassio-addons/commit/c22433ebd6a5336875755cd16b7b9e0e3564a1aa))

### 📌 Release Note

- general App improvements & startup fixes

## 0.1.3 (2026-01-09)

### 📦 Dependencies

- 🚀 release(n8n): version bump [skip-tests] ([`09fb196`](https://github.com/FaserF/hassio-addons/commit/09fb1968338774fcd193caa4e33f80a7cb5cad81))

### 📌 Release Note

- bug fixes and startup improvements

## 0.1.2 (2026-01-09)

### 🎨 Style

- auto-fix (shfmt, black, isort, prettier, markdownlint) ([`72718f5`](https://github.com/FaserF/hassio-addons/commit/72718f5cfc149f65ec936797326b6782ef996461))

### 📌 Release Note

- Dynamic version sourcing via `bashio::App.version` for accurate runtime version display
- Healthcheck timing adjustments for improved reliability
- Startup script improvements and bug fixes
- Auto-formatting applied (shfmt, prettier, markdownlint)

## 0.1.1 (2026-01-08)

## 0.1.0 (2026-01-06)

### 📦 Dependencies

- Update run.sh ([`b3fc648`](https://github.com/FaserF/hassio-addons/commit/b3fc648923c63183c25fd720abd47c88112bc5b3))

### 📌 Release Note

- Manual release via Orchestrator

## 0.0.1

- Initial release
- NGINX web server with PHP 8.4 support
- SSL/TLS support
- MariaDB client support
- Custom configuration file support
- Basic authentication support
- Ingress support

### 📦 Dependencies

- 📝 release(apache2-minimal): update changelog [skip-tests] ([`bb9feed`](https://github.com/FaserF/hassio-addons/commit/bb9feed1d85cbb4f602c85fed4846f536129ec69))

### 📌 Release Note

- Manual release via Orchestrator
