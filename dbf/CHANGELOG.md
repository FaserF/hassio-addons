# Changelog

## 1.1.2 (2026-08-19)

### ✨ Features
- add Google Antigravity Usage monitor addon ([`81495c89`](https://github.com/FaserF/hassio-addons/commit/81495c890a4d15605f44d0ac5c30ff2b85db4dd0))
- Github availablity check ([`8a5c7967`](https://github.com/FaserF/hassio-addons/commit/8a5c7967fe45a835d4763dcde8afa26c8048c502))
- set host_network: true for AegisBot and DBF mDNS discovery and update docs ([`e2a051cc`](https://github.com/FaserF/hassio-addons/commit/e2a051cc3468d9a19bf6ecbae928bd1811d39a84))
- add background mDNS discovery broadcaster ([`db2fee39`](https://github.com/FaserF/hassio-addons/commit/db2fee390e115f863150212cea3093f7f5c22062))
- add restart loop protection to startup banners and fix gt import error ([`da300834`](https://github.com/FaserF/hassio-addons/commit/da3008348fc12ea389004b10665cbae4d7a8e112))

### 🐛 Bug Fixes
- replace deprecated bashio::addon.stop with bashio::app.stop and harmonize APP_VERSION variables ([`e74d22d6`](https://github.com/FaserF/hassio-addons/commit/e74d22d66be715d3ea2efad6e4919b70bf4a81ce))
- resolve participant deduplication and silent native pin mirroring ([`412f921f`](https://github.com/FaserF/hassio-addons/commit/412f921fbfc98370d59fc042249a6bd38e2e4240))
- enable host_network and auto-install zeroconf for mDNS discovery ([`78497903`](https://github.com/FaserF/hassio-addons/commit/78497903208703f15b24d4c2f5e8b6dc8f67bbc6))
- harden parameter expansion in startup banner for set -u strict mode ([`cb8ad15b`](https://github.com/FaserF/hassio-addons/commit/cb8ad15bd5df93dd1da6081ac20ab2332f4d3b29))
- use safe expansion \ for set -u compatibility ([`560bc0fc`](https://github.com/FaserF/hassio-addons/commit/560bc0fce19cd258f025a328ffd5f6addd78f688))

### 📦 Dependencies
- ⬆️ Update Add-on base images ([`cff61763`](https://github.com/FaserF/hassio-addons/commit/cff61763699487bc020cab1735cafd22ebd6f0cf))
- update icons and convert logos to official landscape banners ([`e6d061bd`](https://github.com/FaserF/hassio-addons/commit/e6d061bd8292ae6ca473fa21a2e55d5e5f4e70ea))
- set bridge network as default and update docs on host network and auto-prefill ([`46f8f013`](https://github.com/FaserF/hassio-addons/commit/46f8f013bc619a7fe62f24631053aafc116d7b4d))

### 🚀 Other
- document host_network and zeroconf auto-discovery in AegisBot and DBF ([`5028f478`](https://github.com/FaserF/hassio-addons/commit/5028f47864f66d7c47adc1ccd4b52ef42dae5664))


## 1.1.1 (2026-07-31)

### ✨ Features

- add translations (DE+EN) for sync_full_history, auto_install_integration, and github_token ([`fda5d0d4`](https://github.com/FaserF/hassio-addons/commit/fda5d0d4a7e4e1f532c1b13c0a91c0e997c682ae))
- add auto_install_integration toggle for whatsapp and dbf addons ([`e2a3dd03`](https://github.com/FaserF/hassio-addons/commit/e2a3dd038ffc29f4dc1707e218a11610ed82af39))
- add detailed logging for supervisor discovery registration ([`23938877`](https://github.com/FaserF/hassio-addons/commit/23938877df652a091cf26d4f7f5e3d37f4e533e3))
- enable auto-discovery for dbf addon (db_infoscreen) ([`abdbc335`](https://github.com/FaserF/hassio-addons/commit/abdbc3351d43f1f8e908aa29dbb5b9104bd37ea1))

### 🐛 Bug Fixes

- CI hadolint linter fixes ([`44ea2cc0`](https://github.com/FaserF/hassio-addons/commit/44ea2cc0151b77d64b24e83eacfe2fff00be618d))
- fix UI script loading, tab switching, and HTTP logging ([`7f68ce7b`](https://github.com/FaserF/hassio-addons/commit/7f68ce7bf191699c8ec1701b801d3c669d553f62))

### 📦 Dependencies

- ⬆️ Update ghcr.io/hassio-addons/base Docker tag to v[21.0.1](https://github.com/hassio-addons/addon-base/releases/tag/21.0.1) [skip-tests] ([`094ebba0`](https://github.com/FaserF/hassio-addons/commit/094ebba0fdc857838145fd802b3f0fc04af829a1))
- download integrations from release zips and update workflows ([`d1b640b8`](https://github.com/FaserF/hassio-addons/commit/d1b640b86f729bf90fae51fe101553aa2010d1d0))

### 🚀 Other

- redirect addon support/issues to integration repository ([`5917aec1`](https://github.com/FaserF/hassio-addons/commit/5917aec1f9717207dfbf012404c39c8cb9b86e14))

## 1.1.0 (2026-06-16)

### 📦 Dependencies

- Update Dockerfile ([`97ec5ee4`](https://github.com/FaserF/hassio-addons/commit/97ec5ee4aded13b93c7812175eb66d3e4792d193))
- prepare for alpine 3.24 update ([`05eaab3e`](https://github.com/FaserF/hassio-addons/commit/05eaab3ed98be58349eb469f86ec41f1c4eecd45))
- ⬆️ Update Add-on base images to v21 [skip-tests] ([`2efc4ca0`](https://github.com/FaserF/hassio-addons/commit/2efc4ca058bca977cf5667d3778a6232d45b3ab2))
- ⬆️ Update ghcr.io/hassio-addons/base Docker tag to v[20.1.1](https://github.com/hassio-addons/addon-base/releases/tag/20.1.1) [skip-tests] ([`c798075a`](https://github.com/FaserF/hassio-addons/commit/c798075ac062595a2e1a91754ab9768b47f20c46))
- ⬆️ Update ghcr.io/hassio-addons/base Docker tag to v[20.1.0](https://github.com/hassio-addons/addon-base/releases/tag/20.1.0) [skip-tests] ([`709f7882`](https://github.com/FaserF/hassio-addons/commit/709f7882b67adc67ab6f64370f1d900e9a71b2e1))
- Update Dockerfile ([`11e5c997`](https://github.com/FaserF/hassio-addons/commit/11e5c997a81f5b0eb2949425a97601f9fd747b92))
- fix docker build for musl dependency ([`5c5d45ee`](https://github.com/FaserF/hassio-addons/commit/5c5d45eee91ef4223b5feae85b87011977406dd5))
- ⬆️ Update ghcr.io/hassio-addons/base Docker tag to v[20.0.3](https://github.com/hassio-addons/addon-base/releases/tag/20.0.3) [skip-tests] ([`d765bff1`](https://github.com/FaserF/hassio-addons/commit/d765bff148faae0ef9dfe1a7a4634b4fdc598592))

### 🚀 Other

- docker build fixes ([`8f318832`](https://github.com/FaserF/hassio-addons/commit/8f3188323de16d4d1b3c625c01b4eba4eaca53d4))
- small fix ([`aec266e0`](https://github.com/FaserF/hassio-addons/commit/aec266e0ad07910397fcebc385a9ae4f77be1b7c))
- small fix ([`3fdf71cd`](https://github.com/FaserF/hassio-addons/commit/3fdf71cdf804f5104d819c26187d1ff46223b260))
- fix docker build ([`298af5f1`](https://github.com/FaserF/hassio-addons/commit/298af5f1573406de319adc72840ea82fa78292f3))
- small github CI & dbf addon fixes ([`4fb18866`](https://github.com/FaserF/hassio-addons/commit/4fb18866ddbe6af31e5ea4a8000c0629b41ffdda))
- fix docker build ([`5b40f4ee`](https://github.com/FaserF/hassio-addons/commit/5b40f4ee4d154ada12c7b42ddc526751d7f3f48c))
- fix docker build ([`db25a412`](https://github.com/FaserF/hassio-addons/commit/db25a4124eab24641d43807fc7b97df694d6e758))
- fix docker build in newer alpine version ([`5b16a957`](https://github.com/FaserF/hassio-addons/commit/5b16a9578186b7e8db6093a2bb0d8732a84ee409))
- fix docker build in newer alpine version ([`a588c8a3`](https://github.com/FaserF/hassio-addons/commit/a588c8a3d7aa03377be1e1cd4ba2f6456d60595e))
- fix docker build in newer alpine version ([`2fcb0e33`](https://github.com/FaserF/hassio-addons/commit/2fcb0e33989a51b0ce36a32544b0281b8d82279f))
- fix docker build in newer alpine version ([`eda4f94b`](https://github.com/FaserF/hassio-addons/commit/eda4f94b008875be19eb4708ce0969f42f9a1050))

## 1.0.0 (2026-04-09)

- Initial stable HA App release for DBF

### 🚀 Other

- Port fallback usage if port is already in use ([`ff92c112`](https://github.com/FaserF/hassio-addons/commit/ff92c112d3c16e64e8e21ca3d7e52f4aa2a46960))
- small fix ([`825f53dc`](https://github.com/FaserF/hassio-addons/commit/825f53dc686dcbb37044145e6d7c895601903b5a))

## 0.1.0 (2026-04-09)

### 🚀 Other

- Initial beta release of the **DBF (DB-Infoscreen)** HA App. ([`89f3e365`](https://github.com/FaserF/hassio-addons/commit/89f3e36568d79dd432096760377349e4153c6773))
- Multi-arch support for `aarch64` and `amd64`.
- S6-Overlay for process management.
- Ingress support for the Web UI. ([`2de2075b`](https://github.com/FaserF/hassio-addons/commit/2de2075b90def6c916d13468518ebe0eb16d2255))
- Daily automated updates for `zugbildungsplan.json`.
