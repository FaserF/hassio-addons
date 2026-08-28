# Changelog

## 0.4.5 (2026-08-28)

### ✨ Features
- move in-development add-ons to .dev/ directory to hide from stable repository in Home Assistant ([`2e804917`](https://github.com/FaserF/hassio-addons/commit/2e8049174658ea37ac75009502669b59c49f2404))

### 🐛 Bug Fixes
- eliminate duplicate alert blocks and standardize README notice cleaning ([`fdf7b787`](https://github.com/FaserF/hassio-addons/commit/fdf7b787f1450d3e372795a968a68b6b721181a4))
- regenerate accurate changelogs for all addons and fix release commit matching in bump_version.py ([`b667eef9`](https://github.com/FaserF/hassio-addons/commit/b667eef9f23c882efd02c11535c2ea4c9bbad5f5))

### 📦 Dependencies
- ⬆️ Update ghcr.io/hassio-addons/base Docker tag to v[21.0.3](https://github.com/hassio-addons/addon-base/releases/tag/21.0.3) ([`00265df2`](https://github.com/FaserF/hassio-addons/commit/00265df231b32c916e0470852ef907b2d942b8d4))

### 📝 Documentation
- ci: integrate in-development add-ons blacklist across workflows, scripts and README generators ([`6f5b41cc`](https://github.com/FaserF/hassio-addons/commit/6f5b41cc98d3fc3592543b75ad72bd7a4f331825))

### 🚀 Other
- Standardize log_level configuration and handling across all add-ons ([`7ddda206`](https://github.com/FaserF/hassio-addons/commit/7ddda206529ef9453a58d36af03969ed975a8e66))


## 0.4.4 (2026-08-19)

### ✨ Features

- add Google Antigravity Usage monitor addon ([`81495c890`](https://github.com/FaserF/hassio-addons/commit/81495c890a4d15605f44d0ac5c30ff2b85db4dd0))
- Github availablity check ([`8a5c7967f`](https://github.com/FaserF/hassio-addons/commit/8a5c7967fe45a835d4763dcde8afa26c8048c502))

### 🐛 Bug Fixes

- replace deprecated bashio::addon.stop with bashio::app.stop and harmonize APP_VERSION variables ([`e74d22d66`](https://github.com/FaserF/hassio-addons/commit/e74d22d66be715d3ea2efad6e4919b70bf4a81ce))
- harden parameter expansion in startup banner for set -u strict mode ([`cb8ad15bd`](https://github.com/FaserF/hassio-addons/commit/cb8ad15bd5df93dd1da6081ac20ab2332f4d3b29))
- use safe expansion \ for set -u compatibility ([`560bc0fce`](https://github.com/FaserF/hassio-addons/commit/560bc0fce19cd258f025a328ffd5f6addd78f688))
- add restart loop protection to startup banners and fix gt import error ([`da3008348`](https://github.com/FaserF/hassio-addons/commit/da3008348fc12ea389004b10665cbae4d7a8e112))

### 📦 Dependencies

- ⬆️ Update Add-on base images ([`cff617636`](https://github.com/FaserF/hassio-addons/commit/cff61763699487bc020cab1735cafd22ebd6f0cf))
- update icons and convert logos to official landscape banners ([`e6d061bd8`](https://github.com/FaserF/hassio-addons/commit/e6d061bd8292ae6ca473fa21a2e55d5e5f4e70ea))
- ⬆️ Update dependency alpine_edge/nginx to v1.30.4-r3 (#959) ([`789b729c2`](https://github.com/FaserF/hassio-addons/commit/789b729c22fc3fac09d984d05cb6a53dc0547ee8))

## 0.4.3 (2026-07-31)

### ✨ Features

- add detailed logging for supervisor discovery registration ([`23938877`](https://github.com/FaserF/hassio-addons/commit/23938877df652a091cf26d4f7f5e3d37f4e533e3))
- trigger supervisor discovery for webserver_app during addon startup ([`bc5834be`](https://github.com/FaserF/hassio-addons/commit/bc5834be812484c75b0aae2deef4bc9e391b6f63))
- add discovery key for webserver_app to webserver config.yaml files ([`0e554dc1`](https://github.com/FaserF/hassio-addons/commit/0e554dc1df72a9c693ff197cf25dcf784adaccff))

### 🐛 Bug Fixes

- CI hadolint linter fixes ([`44ea2cc0`](https://github.com/FaserF/hassio-addons/commit/44ea2cc0151b77d64b24e83eacfe2fff00be618d))
- small fix for integration management ([`dc589881`](https://github.com/FaserF/hassio-addons/commit/dc589881ae3bfc7b0234759f816d2e42963559aa))

### 📦 Dependencies

- ⬆️ Update ghcr.io/hassio-addons/base Docker tag to v[21.0.1](https://github.com/hassio-addons/addon-base/releases/tag/21.0.1) [skip-tests] ([`094ebba0`](https://github.com/FaserF/hassio-addons/commit/094ebba0fdc857838145fd802b3f0fc04af829a1))
- ⬆️ Update dependency alpine_edge/nginx to v1.30.4-r2 [skip-tests] (#906) [skip-tests] ([`cde7e338`](https://github.com/FaserF/hassio-addons/commit/cde7e33808c76f0d76eef9a4671276aedd80b116))
- ⬆️ Update dependency alpine_edge/nginx to v1.30.4-r1 [skip-tests] (#900) [skip-tests] ([`d44f50d0`](https://github.com/FaserF/hassio-addons/commit/d44f50d0ee4618fe24e1d4b823e8fbbd29b54405))
- ⬆️ Update dependency alpine_edge/nginx to v1.30.4-r0 [skip-tests] (#898) [skip-tests] ([`44144794`](https://github.com/FaserF/hassio-addons/commit/4414479461dde120ef932fd513e9b1bcd026937e))

### 🚀 Other

- replace deprecated map commands ([`13e55395`](https://github.com/FaserF/hassio-addons/commit/13e553958efef24d58296f33f9f9e3893ae8bcf2))

## 0.4.2 (2026-06-29)

### 🐛 Bug Fixes

- mod_rewrite & .htaccess usage ([`4bcae452`](https://github.com/FaserF/hassio-addons/commit/4bcae4529e7823d4c0fcc43c66f3d3ab648bd15d))
- fix shellcheck SC2001 & directory check for manifest.json ([`23b985f6`](https://github.com/FaserF/hassio-addons/commit/23b985f617fac95390f6d3ff04130459fee5de1a))

### 📦 Dependencies

- update integration links in standardization script and regenerate readmes ([`3645d7f9`](https://github.com/FaserF/hassio-addons/commit/3645d7f96b6d6890e311acce4b5983da25e0e9c3))
- download integrations from release zips and update workflows ([`d1b640b8`](https://github.com/FaserF/hassio-addons/commit/d1b640b86f729bf90fae51fe101553aa2010d1d0))
- ⬆️ Update dependency alpine_edge/nginx to v1.30.3-r0 [skip-tests] (#854) [skip-tests] ([`e45c2004`](https://github.com/FaserF/hassio-addons/commit/e45c2004d266e2ba2b66073c87c5cbba1ba2195e))

## 0.4.1 (2026-06-17)

### 🚀 Other

- fix ssl cert usage in webserver addons #845 ([`052678eb`](https://github.com/FaserF/hassio-addons/commit/052678eb49bd814b8cfcdd9f88f4a5c3446cfa5c))

## 0.4.0 (2026-06-16)

### 📦 Dependencies

- ⬆️ Update Add-on base images to v21 [skip-tests] ([`2efc4ca0`](https://github.com/FaserF/hassio-addons/commit/2efc4ca058bca977cf5667d3778a6232d45b3ab2))

## 0.3.2 (2026-06-04)

### 📦 Dependencies

- bump and fix nginx version ([`ee902bd6`](https://github.com/FaserF/hassio-addons/commit/ee902bd686bd22fcb150bf8d22ed9939439c6e0c))
- ⬆️ Update ghcr.io/hassio-addons/base Docker tag to v[20.1.1](https://github.com/hassio-addons/addon-base/releases/tag/20.1.1) [skip-tests] ([`c798075a`](https://github.com/FaserF/hassio-addons/commit/c798075ac062595a2e1a91754ab9768b47f20c46))
- ⬆️ Update ghcr.io/hassio-addons/base Docker tag to v[20.1.0](https://github.com/hassio-addons/addon-base/releases/tag/20.1.0) [skip-tests] ([`709f7882`](https://github.com/FaserF/hassio-addons/commit/709f7882b67adc67ab6f64370f1d900e9a71b2e1))
- update dependencies ([`820d570f`](https://github.com/FaserF/hassio-addons/commit/820d570f49f651f19e4ba7b3fdf0e1d4030ed35e))
- fix docker build for musl dependency ([`5c5d45ee`](https://github.com/FaserF/hassio-addons/commit/5c5d45eee91ef4223b5feae85b87011977406dd5))
- ⬆️ Update ghcr.io/hassio-addons/base Docker tag to v[20.0.3](https://github.com/hassio-addons/addon-base/releases/tag/20.0.3) [skip-tests] ([`d765bff1`](https://github.com/FaserF/hassio-addons/commit/d765bff148faae0ef9dfe1a7a4634b4fdc598592))

### 🚀 Other

- fixed permissions needed for wordpress #808 ([`8c8ac443`](https://github.com/FaserF/hassio-addons/commit/8c8ac4434e60140d5244fb665b19cc69138786f7))
- fix docker build ([`db25a412`](https://github.com/FaserF/hassio-addons/commit/db25a4124eab24641d43807fc7b97df694d6e758))
- fix docker build in newer alpine version ([`86bfc25f`](https://github.com/FaserF/hassio-addons/commit/86bfc25fa7528eba34bf57b1eb9a40fb62dba0a5))
- fix docker build in newer alpine version ([`7a040ec8`](https://github.com/FaserF/hassio-addons/commit/7a040ec8304f4f6ffc2a5dbbcc237ef19e9aca10))
- fix docker build in newer alpine version ([`5b16a957`](https://github.com/FaserF/hassio-addons/commit/5b16a9578186b7e8db6093a2bb0d8732a84ee409))
- fix docker build in newer alpine version ([`eda4f94b`](https://github.com/FaserF/hassio-addons/commit/eda4f94b008875be19eb4708ce0969f42f9a1050))

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
