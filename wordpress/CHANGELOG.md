# Changelog

## 0.4.3 (2026-08-28)

### ✨ Features

- move in-development add-ons to .dev/ directory to hide from stable repository in Home Assistant ([`2e804917`](https://github.com/FaserF/hassio-addons/commit/2e8049174658ea37ac75009502669b59c49f2404))

### 🐛 Bug Fixes

- migrate user bundles from s6-rc.d to user-bundles.d to fix deprecation warning ([`73156ded`](https://github.com/FaserF/hassio-addons/commit/73156ded6152ca7cab2e34950ec95461dd4fb4dd))
- eliminate duplicate alert blocks and standardize README notice cleaning ([`fdf7b787`](https://github.com/FaserF/hassio-addons/commit/fdf7b787f1450d3e372795a968a68b6b721181a4))
- regenerate accurate changelogs for all addons and fix release commit matching in bump_version.py ([`b667eef9`](https://github.com/FaserF/hassio-addons/commit/b667eef9f23c882efd02c11535c2ea4c9bbad5f5))

### 📦 Dependencies

- ⬆️ Update ghcr.io/hassio-addons/base Docker tag to v[21.0.3](https://github.com/hassio-addons/addon-base/releases/tag/21.0.3) ([`00265df2`](https://github.com/FaserF/hassio-addons/commit/00265df231b32c916e0470852ef907b2d942b8d4))

### 🔧 Configuration

- deactivate dev sync workflow, delete local dev branch, and point in-dev notices exclusively to Edge channel ([`eb3f45de`](https://github.com/FaserF/hassio-addons/commit/eb3f45de16d3e72806094cff745bd3a727ae3ef8))

### 📝 Documentation

- ci: integrate in-development add-ons blacklist across workflows, scripts and README generators ([`6f5b41cc`](https://github.com/FaserF/hassio-addons/commit/6f5b41cc98d3fc3592543b75ad72bd7a4f331825))

### 🚀 Other

- Standardize log_level configuration and handling across all add-ons ([`7ddda206`](https://github.com/FaserF/hassio-addons/commit/7ddda206529ef9453a58d36af03969ed975a8e66))

## 0.4.2 (2026-08-19)

### ✨ Features

- add Google Antigravity Usage monitor addon ([`81495c890`](https://github.com/FaserF/hassio-addons/commit/81495c890a4d15605f44d0ac5c30ff2b85db4dd0))

### 🐛 Bug Fixes

- convert pseudo-PNG jpeg images to genuine PNG format and improve autofix ([`9803f56c2`](https://github.com/FaserF/hassio-addons/commit/9803f56c2606138cf0e41de1c02368cf2b32566c))
- replace deprecated bashio::addon.stop with bashio::app.stop and harmonize APP_VERSION variables ([`e74d22d66`](https://github.com/FaserF/hassio-addons/commit/e74d22d66be715d3ea2efad6e4919b70bf4a81ce))
- harden parameter expansion in startup banner for set -u strict mode ([`cb8ad15bd`](https://github.com/FaserF/hassio-addons/commit/cb8ad15bd5df93dd1da6081ac20ab2332f4d3b29))
- use safe expansion \ for set -u compatibility ([`560bc0fce`](https://github.com/FaserF/hassio-addons/commit/560bc0fce19cd258f025a328ffd5f6addd78f688))
- add restart loop protection to startup banners and fix gt import error ([`da3008348`](https://github.com/FaserF/hassio-addons/commit/da3008348fc12ea389004b10665cbae4d7a8e112))

### 📦 Dependencies

- ⬆️ Update Add-on base images ([`cff617636`](https://github.com/FaserF/hassio-addons/commit/cff61763699487bc020cab1735cafd22ebd6f0cf))
- update icons and convert logos to official landscape banners ([`e6d061bd8`](https://github.com/FaserF/hassio-addons/commit/e6d061bd8292ae6ca473fa21a2e55d5e5f4e70ea))

## 0.4.1 (2026-07-31)

### 🐛 Bug Fixes

- CI hadolint linter fixes ([`44ea2cc0`](https://github.com/FaserF/hassio-addons/commit/44ea2cc0151b77d64b24e83eacfe2fff00be618d))

### 📦 Dependencies

- ⬆️ Update ghcr.io/hassio-addons/base Docker tag to v[21.0.1](https://github.com/hassio-addons/addon-base/releases/tag/21.0.1) [skip-tests] ([`094ebba0`](https://github.com/FaserF/hassio-addons/commit/094ebba0fdc857838145fd802b3f0fc04af829a1))

## 0.4.0 (2026-06-16)

### 📦 Dependencies

- ⬆️ Update Add-on base images to v21 [skip-tests] ([`2efc4ca0`](https://github.com/FaserF/hassio-addons/commit/2efc4ca058bca977cf5667d3778a6232d45b3ab2))
- ⬆️ Update ghcr.io/hassio-addons/base Docker tag to v[20.1.1](https://github.com/hassio-addons/addon-base/releases/tag/20.1.1) [skip-tests] ([`c798075a`](https://github.com/FaserF/hassio-addons/commit/c798075ac062595a2e1a91754ab9768b47f20c46))
- ⬆️ Update ghcr.io/hassio-addons/base Docker tag to v[20.1.0](https://github.com/hassio-addons/addon-base/releases/tag/20.1.0) [skip-tests] ([`709f7882`](https://github.com/FaserF/hassio-addons/commit/709f7882b67adc67ab6f64370f1d900e9a71b2e1))
- fix docker build for musl dependency ([`5c5d45ee`](https://github.com/FaserF/hassio-addons/commit/5c5d45eee91ef4223b5feae85b87011977406dd5))
- ⬆️ Update ghcr.io/hassio-addons/base Docker tag to v[20.0.3](https://github.com/hassio-addons/addon-base/releases/tag/20.0.3) [skip-tests] ([`d765bff1`](https://github.com/FaserF/hassio-addons/commit/d765bff148faae0ef9dfe1a7a4634b4fdc598592))

### 🚀 Other

- CI supervisor test fixes ([`c5acd8a5`](https://github.com/FaserF/hassio-addons/commit/c5acd8a53079cd4b2d746699c397cc3499e47613))
- fix docker build ([`db25a412`](https://github.com/FaserF/hassio-addons/commit/db25a4124eab24641d43807fc7b97df694d6e758))
- fix docker build in newer alpine version ([`86bfc25f`](https://github.com/FaserF/hassio-addons/commit/86bfc25fa7528eba34bf57b1eb9a40fb62dba0a5))
- fix docker build in newer alpine version ([`7a040ec8`](https://github.com/FaserF/hassio-addons/commit/7a040ec8304f4f6ffc2a5dbbcc237ef19e9aca10))

## 0.3.1 (2026-04-09)

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
- Unix LF fixes ([`7ef9b1f5`](https://github.com/FaserF/hassio-addons/commit/7ef9b1f5723dfdbfcca3cbe2de944538bc095fb9))
- Add stage tags ([`75528e61`](https://github.com/FaserF/hassio-addons/commit/75528e6193a0ce55537d2f89fe6069a703f7da88))
- improved DB reset option ([`01cb6fed`](https://github.com/FaserF/hassio-addons/commit/01cb6fed05abe9406223d3b93a5a7b9f968d0f95))
- more small linter improvements ([`c1c2a452`](https://github.com/FaserF/hassio-addons/commit/c1c2a4528971f3fdc96892b37f5f6af6ae246c43))
- linter fixes & improved default app banner ([`19bc94d9`](https://github.com/FaserF/hassio-addons/commit/19bc94d9e306bb9f425a2a96bbb94dc47809cead))
- security & docs improvements codeql ([`a4a06f09`](https://github.com/FaserF/hassio-addons/commit/a4a06f09bab3956a81fe1dc81bf3ce991e3c83d1))
- small fixes & linter improvements ([`33150324`](https://github.com/FaserF/hassio-addons/commit/331503241aa11ccfb398a6cbf5b850aeec084ef2))
- replace basio addon with bashio apps ([`2caaf920`](https://github.com/FaserF/hassio-addons/commit/2caaf920939dbb61243d2ed1e8f63518a3199aa9))
- Follow new Homeassistant Apps naming ([`a63066b1`](https://github.com/FaserF/hassio-addons/commit/a63066b111f275f9b359bf0e1cea3c49a14fb31c))
- Link fixes ([`80a29ecd`](https://github.com/FaserF/hassio-addons/commit/80a29ecd14061b993f8fcde6d8c1865d15cce14e))

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
- more small improvements ([`c6795db7`](https://github.com/FaserF/hassio-addons/commit/c6795db72e0c61bf187781ae186f53eb0bc8a108))
- small fixes ([`60c5ddf4`](https://github.com/FaserF/hassio-addons/commit/60c5ddf4fede8242031082aa8e7fa0d057c0087f))

## 0.2.0 (2026-01-11)

### 🎨 Style

### 🚀 Other

- more CI fixes & App db reset improvements ([`fc27cc3b`](https://github.com/FaserF/hassio-addons/commit/fc27cc3bee4a9a34fd573f38e870ff921b3f7d3d))
- New/improved log level option ([`73d8e254`](https://github.com/FaserF/hassio-addons/commit/73d8e254b10e01aaffc474d22192d2b8deea4c79))
- more small improvements ([`c6795db7`](https://github.com/FaserF/hassio-addons/commit/c6795db72e0c61bf187781ae186f53eb0bc8a108))

### 📌 Release Note

- new db reset option & log level improved/added

## 0.1.4 (2026-01-10)

### 🎨 Style

### 🚀 Other

- small fixes ([`60c5ddf4`](https://github.com/FaserF/hassio-addons/commit/60c5ddf4fede8242031082aa8e7fa0d057c0087f))

### 📌 Release Note

- general background fixes and stability improvements

## 0.1.3 (2026-01-10)

### 🎨 Style

### 🚀 Other

- Miscellaneous App and CI fixes ([`2fba1d9f`](https://github.com/FaserF/hassio-addons/commit/2fba1d9f8434d00c4cf2bf9f7c383f4dd587c11e), [`200cf2ac`](https://github.com/FaserF/hassio-addons/commit/200cf2acd876f6498f462218e15964d04dd55e32), [`86f854df`](https://github.com/FaserF/hassio-addons/commit/86f854dfb61087009493592c00f7ccc20f850b46), [`10a0d863`](https://github.com/FaserF/hassio-addons/commit/10a0d86384d4af5450b3302f7552c2323ddc4d30), [`97345da9`](https://github.com/FaserF/hassio-addons/commit/97345da944580528955f6e0d0263cd86e2c27cc4), [`eee371bd`](https://github.com/FaserF/hassio-addons/commit/eee371bd2cdd4bdd588b7bdb88b88da8440bd50b))
- Startup process and error handling improvements ([`38002764`](https://github.com/FaserF/hassio-addons/commit/38002764e048111700743eae38c3c3a27b7a0620), [`92067a90`](https://github.com/FaserF/hassio-addons/commit/92067a90eaa77d3ffd5cb8db868e49ced7c2c203), [`4ffa13df`](https://github.com/FaserF/hassio-addons/commit/4ffa13df8920353d8951d45925c9556c3da2d9ea), [`73f66452`](https://github.com/FaserF/hassio-addons/commit/73f664520179285d2433f1af3762eed4a3cc8265), [`eb6972f0`](https://github.com/FaserF/hassio-addons/commit/eb6972f0a45892c750d7b187e54e94215f6dd284))
- General App stability improvements ([`76a46480`](https://github.com/FaserF/hassio-addons/commit/76a46480bd599064f48041baed3b8b34e871eebd), [`4caaec4b`](https://github.com/FaserF/hassio-addons/commit/4caaec4b6ea5d3eb5be2829e0d2f941c37b8e7f3), [`070c421a`](https://github.com/FaserF/hassio-addons/commit/070c421a5d01917939f6b0a37eb7e62a1e0c5c17), [`71225476`](https://github.com/FaserF/hassio-addons/commit/712254766409609febf6ab80d451bc580216d990))

### 📌 Release Note

- general App improvements & startup fixes

## 0.1.2 (2026-01-09)

### 📦 Dependencies

### 📌 Release Note

- bug fixes and startup improvements

## 0.1.1 (2026-01-09)

### 🎨 Style

### 📌 Release Note

- General App structure improvements and startup bug fixes

## 0.1.0 (2026-01-06)

### 📦 Dependencies

- Update run.sh ([`b3fc648`](https://github.com/FaserF/hassio-addons/commit/b3fc648923c63183c25fd720abd47c88112bc5b3))

### 📌 Release Note

- Manual release via Orchestrator

## 0.0.1

- Initial release
