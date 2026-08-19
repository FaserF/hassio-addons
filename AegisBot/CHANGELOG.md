# Changelog

## 0.6.2 (2026-08-19)

### ✨ Features
- add Google Antigravity Usage monitor addon ([`81495c89`](https://github.com/FaserF/hassio-addons/commit/81495c890a4d15605f44d0ac5c30ff2b85db4dd0))
- Github availablity check ([`8a5c7967`](https://github.com/FaserF/hassio-addons/commit/8a5c7967fe45a835d4763dcde8afa26c8048c502))
- add cmake, openblas and linux-headers to Dockerfile and re-enable faster-whisper dependency ([`3ee18e33`](https://github.com/FaserF/hassio-addons/commit/3ee18e333d202168dd66a9b2e04a1ad6d7f55cb8))

### 🐛 Bug Fixes
- regenerate accurate changelogs for all addons and fix release commit matching in bump_version.py ([`b667eef9`](https://github.com/FaserF/hassio-addons/commit/b667eef9f23c882efd02c11535c2ea4c9bbad5f5))
- convert pseudo-PNG jpeg images to genuine PNG format and improve autofix ([`9803f56c`](https://github.com/FaserF/hassio-addons/commit/9803f56c2606138cf0e41de1c02368cf2b32566c))
- replace deprecated bashio::addon.stop with bashio::app.stop and harmonize APP_VERSION variables ([`e74d22d6`](https://github.com/FaserF/hassio-addons/commit/e74d22d66be715d3ea2efad6e4919b70bf4a81ce))
- small fixes ([`dfa67c70`](https://github.com/FaserF/hassio-addons/commit/dfa67c70e23664d0d3f8486cad46a048e7f3d5ae))
- remove faster-whisper from requirements.txt to avoid ctranslate2 musllinux build errors ([`cedd8d66`](https://github.com/FaserF/hassio-addons/commit/cedd8d6657fdaff4c9f19fca59ecb90b935155d7))

### 📦 Dependencies
- ⬆️ Update dependency openai to v3.3.1 (#1000) ([`897a738c`](https://github.com/FaserF/hassio-addons/commit/897a738cc775b4df763a1bb206d8b12ce69691b7))
- ⬆️ Update dependency uvicorn to v0.52.4 ([`650cd95f`](https://github.com/FaserF/hassio-addons/commit/650cd95f28daf01ea5cf29c61add4f1fab763764))
- update icons and convert logos to official landscape banners ([`e6d061bd`](https://github.com/FaserF/hassio-addons/commit/e6d061bd8292ae6ca473fa21a2e55d5e5f4e70ea))
- ⬆️ Update dependency openai to v3.3.0 (#996) ([`605dc796`](https://github.com/FaserF/hassio-addons/commit/605dc796f307f24a30988842140c27168f5a2bfb))
- ⬆️ Update dependency openai to v3.2.0 (#995) ([`b4e37f66`](https://github.com/FaserF/hassio-addons/commit/b4e37f66564843a2f2a9c5b5bd13f95d7ba34116))
- Update requirements.txt ([`c77c7dff`](https://github.com/FaserF/hassio-addons/commit/c77c7dff413d5a5f08970dacaf0d13a241d900e3))
- ⬆️ Update dependency faster-whisper to v1.2.1 ([`776c4361`](https://github.com/FaserF/hassio-addons/commit/776c436121c1b63ce63b1308242c53632846c303))


## 0.6.1 (2026-08-19)

### ✨ Features

- add Google Antigravity Usage monitor addon ([`81495c890`](https://github.com/FaserF/hassio-addons/commit/81495c890a4d15605f44d0ac5c30ff2b85db4dd0))
- Github availablity check ([`8a5c7967f`](https://github.com/FaserF/hassio-addons/commit/8a5c7967fe45a835d4763dcde8afa26c8048c502))
- add cmake, openblas and linux-headers to Dockerfile and re-enable faster-whisper dependency ([`3ee18e333`](https://github.com/FaserF/hassio-addons/commit/3ee18e333d202168dd66a9b2e04a1ad6d7f55cb8))
- support AegisBot STT provider, native dice/roll commands and dependencies ([`70c5f3cc6`](https://github.com/FaserF/hassio-addons/commit/70c5f3cc65b56cbc589ca116d7e81c7302e12d8b))
- send server and addon version in /about command for WhatsApp and AegisBot ([`c60f954ed`](https://github.com/FaserF/hassio-addons/commit/c60f954ed28a0113750d3b1c6ca19b372a5ac9b9))
- configure specific startup phases and integration discovery for relevant addons ([`2f939fbd8`](https://github.com/FaserF/hassio-addons/commit/2f939fbd8771f1d02798081dff4759e5c67fcc88))
- set host_network: true for AegisBot and DBF mDNS discovery and update docs ([`e2a051cc3`](https://github.com/FaserF/hassio-addons/commit/e2a051cc3468d9a19bf6ecbae928bd1811d39a84))
- add dedicated JSON file upload button & drag-and-drop support for group config import ([`de52ae91d`](https://github.com/FaserF/hassio-addons/commit/de52ae91dec0c87dab8e664d362460ffd47e8228))
- add first_admin_password option for initial admin credentials ([`bc829e4b0`](https://github.com/FaserF/hassio-addons/commit/bc829e4b015a81f7471e9409b8ea2441c3d25250))

### 🐛 Bug Fixes

- convert pseudo-PNG jpeg images to genuine PNG format and improve autofix ([`9803f56c2`](https://github.com/FaserF/hassio-addons/commit/9803f56c2606138cf0e41de1c02368cf2b32566c))
- replace deprecated bashio::addon.stop with bashio::app.stop and harmonize APP_VERSION variables ([`e74d22d66`](https://github.com/FaserF/hassio-addons/commit/e74d22d66be715d3ea2efad6e4919b70bf4a81ce))
- remove faster-whisper from requirements.txt to avoid ctranslate2 musllinux build errors ([`cedd8d665`](https://github.com/FaserF/hassio-addons/commit/cedd8d6657fdaff4c9f19fca59ecb90b935155d7))
- preserve port and host header in nginx proxy ([`b5702e842`](https://github.com/FaserF/hassio-addons/commit/b5702e84261395da9e21db6f0adbc81adee83bdb))
- remove vite base './' patch from frontend build ([`612c914fd`](https://github.com/FaserF/hassio-addons/commit/612c914fd0942e20149021209cb4b67cd7dd9680))
- enable host_network and auto-install zeroconf for mDNS discovery ([`784979032`](https://github.com/FaserF/hassio-addons/commit/78497903208703f15b24d4c2f5e8b6dc8f67bbc6))
- pin websockets==16.0 to resolve google-genai dependency conflict ([`db588e934`](https://github.com/FaserF/hassio-addons/commit/db588e934ebe2668b8395e0f1171bc0c9d4894f0))
- fix line continuation syntax error in Dockerfile before COPY command ([`45dee3a05`](https://github.com/FaserF/hassio-addons/commit/45dee3a05a8ab54d725b9c6c1cae746a1b9fa4db))
- pre-install python core dependencies in Dockerfile and add uvicorn auto-install fallback in run.sh ([`2a1b857e1`](https://github.com/FaserF/hassio-addons/commit/2a1b857e1b49dc5225aa3986b2d5719612a62d49))
- fix Nginx location /api/ proxy_pass URI mapping for uvicorn backend ([`5778e9ac7`](https://github.com/FaserF/hassio-addons/commit/5778e9ac78c37cfd560d761131e08641493ff557))
- add explicit ingress_port: 8077 to config.yaml ([`0e711b25c`](https://github.com/FaserF/hassio-addons/commit/0e711b25cf7b32ce9962413a208e6832210be814))
- prevent protocolMessage metadata leakage and deduplicate edit events ([`f185914dc`](https://github.com/FaserF/hassio-addons/commit/f185914dc7bf9cf4953db0b3f2a9c553af610c6f))
- ensure DB files across all paths are wiped during database reset ([`ec8bdf1c1`](https://github.com/FaserF/hassio-addons/commit/ec8bdf1c1872aca3ee2e606878e105e85ad5923a))
- harden parameter expansion in startup banner for set -u strict mode ([`cb8ad15bd`](https://github.com/FaserF/hassio-addons/commit/cb8ad15bd5df93dd1da6081ac20ab2332f4d3b29))
- use safe expansion \ for set -u compatibility ([`560bc0fce`](https://github.com/FaserF/hassio-addons/commit/560bc0fce19cd258f025a328ffd5f6addd78f688))

### 📦 Dependencies

- ⬆️ Update dependency uvicorn to v0.52.4 ([`650cd95f2`](https://github.com/FaserF/hassio-addons/commit/650cd95f28daf01ea5cf29c61add4f1fab763764))
- update icons and convert logos to official landscape banners ([`e6d061bd8`](https://github.com/FaserF/hassio-addons/commit/e6d061bd8292ae6ca473fa21a2e55d5e5f4e70ea))
- ⬆️ Update dependency openai to v3.3.0 (#996) ([`605dc796f`](https://github.com/FaserF/hassio-addons/commit/605dc796f307f24a30988842140c27168f5a2bfb))
- ⬆️ Update dependency openai to v3.2.0 (#995) ([`b4e37f665`](https://github.com/FaserF/hassio-addons/commit/b4e37f66564843a2f2a9c5b5bd13f95d7ba34116))
- Update requirements.txt ([`c77c7dff4`](https://github.com/FaserF/hassio-addons/commit/c77c7dff413d5a5f08970dacaf0d13a241d900e3))
- ⬆️ Update dependency faster-whisper to v1.2.1 ([`776c43612`](https://github.com/FaserF/hassio-addons/commit/776c436121c1b63ce63b1308242c53632846c303))
- ⬆️ Update dependency python-dotenv to v1.2.3 (#981) ([`08e83a926`](https://github.com/FaserF/hassio-addons/commit/08e83a92665094c01b26032bbba9934b27ad300f))
- ⬆️ Update dependency openai to v3.1.0 (#980) ([`a644b6f89`](https://github.com/FaserF/hassio-addons/commit/a644b6f89d68ad8aba4a13490e0be26337c48114))
- ⬆️ Update dependency google-genai to v2.18.1 (#977) ([`b1a19411f`](https://github.com/FaserF/hassio-addons/commit/b1a19411f8ead5f8dc4b87ba0489e88a5ff84bcf))
- ⬆️ Pin dependency zeroconf to ==0.150.0 (#976) ([`c3ebf3515`](https://github.com/FaserF/hassio-addons/commit/c3ebf35154e39eb5f2f508c70ce63ee28a993a0a))
- set bridge network as default and update docs on host network and auto-prefill ([`46f8f013b`](https://github.com/FaserF/hassio-addons/commit/46f8f013bc619a7fe62f24631053aafc116d7b4d))
- ⬆️ Update dependency uvicorn to v0.52.3 (#974) ([`d372d687d`](https://github.com/FaserF/hassio-addons/commit/d372d687d92aae6b52e9e26ded6178d5b69ec453))
- ⬆️ Update dependency websockets to v16.1.1 (#975) ([`93de21f61`](https://github.com/FaserF/hassio-addons/commit/93de21f619e1aa3a58f5cec6b85b095364359ef3))
- ⬆️ Pin dependencies (#973) ([`9bb578aba`](https://github.com/FaserF/hassio-addons/commit/9bb578aba155c8b8eac7507ceb3c8c8a74f28b3d))

### 🔒 Security

- security: redact raw malicious URLs/filenames from Security Shield warning messages ([`ade966039`](https://github.com/FaserF/hassio-addons/commit/ade966039b2598e67454d06150f65b21032bfa5e))

### 🚀 Other

- small fixes ([`dfa67c70e`](https://github.com/FaserF/hassio-addons/commit/dfa67c70e23664d0d3f8486cad46a048e7f3d5ae))
- improved auto versioning ([`6426777db`](https://github.com/FaserF/hassio-addons/commit/6426777db225d2eac785b190788ce2f0f9eb5653))
- document host_network and zeroconf auto-discovery in AegisBot and DBF ([`5028f4786`](https://github.com/FaserF/hassio-addons/commit/5028f47864f66d7c47adc1ccd4b52ef42dae5664))
- small fixes ([`2d647895f`](https://github.com/FaserF/hassio-addons/commit/2d647895f170fbc5febe683bcb7cc0c4937029fa))
- small fix ([`fbf111681`](https://github.com/FaserF/hassio-addons/commit/fbf111681f949629e1690ff83e2c6a71b7a5d385))
- small fixes ([`d0f7207cc`](https://github.com/FaserF/hassio-addons/commit/d0f7207cc23afb1ba93d093d4091db96d3166d53))

## 0.6.0 (2026-06-16)

### 🚀 Other

- CI supervisor test fixes ([`c5acd8a5`](https://github.com/FaserF/hassio-addons/commit/c5acd8a53079cd4b2d746699c397cc3499e47613))

## 0.5.3 (2026-04-09)

### 📦 Dependencies

- Update run.sh ([`e2459f57`](https://github.com/FaserF/hassio-addons/commit/e2459f576abaca3ad4221fa58fb8820607369a5d))

### 🚀 Other

- fix HA list usage ([`e4636cd1`](https://github.com/FaserF/hassio-addons/commit/e4636cd1b2a8e60b1a3c23523b8d08a1a22c24b2))
- HA list interpretation fixes ([`4159d335`](https://github.com/FaserF/hassio-addons/commit/4159d33573e37cd633c097935a3efa47c84f1728))
- remove n8n ([`5527a8ef`](https://github.com/FaserF/hassio-addons/commit/5527a8efd422443dbe3ea0bd2583a5a08605ae94))
- app version injection improvements ([`63580a20`](https://github.com/FaserF/hassio-addons/commit/63580a201a16724ac7712b1ed52c4f195ab05fe4))
- use docker WORKDIR ([`928d223a`](https://github.com/FaserF/hassio-addons/commit/928d223a27fbdae3e6e0db8a5d37ef13416e6d6b))
- CI Test fixes ([`5d9969b0`](https://github.com/FaserF/hassio-addons/commit/5d9969b06c47352cdd4ce1703ced2903bc370fdb))
- Add stage tags ([`75528e61`](https://github.com/FaserF/hassio-addons/commit/75528e6193a0ce55537d2f89fe6069a703f7da88))
- small fix ([`07257a4f`](https://github.com/FaserF/hassio-addons/commit/07257a4f5531437b83ebc513d3ffae4b4d532dfd))
- fix repo link ([`bddaa7bd`](https://github.com/FaserF/hassio-addons/commit/bddaa7bd419f7f35aa3343dfc704507544958c14))
- fix DB reset ([`c891d261`](https://github.com/FaserF/hassio-addons/commit/c891d26105c96c6f034ece97c3de9b61e5b9dbb9))
- improved DB reset option ([`01cb6fed`](https://github.com/FaserF/hassio-addons/commit/01cb6fed05abe9406223d3b93a5a7b9f968d0f95))
- fix DB reset ([`dc9fd3d5`](https://github.com/FaserF/hassio-addons/commit/dc9fd3d530abcaf07ffe7fc4f7ea605f69bfacb6))
- fixes for new webserver integration ([`5e1439dd`](https://github.com/FaserF/hassio-addons/commit/5e1439dd399069225f4dcbcc9494000134b8efe0))

## 0.5.2 (2026-03-23)

### 🚀 Other

- make config options optional ([`bef307b3`](https://github.com/FaserF/hassio-addons/commit/bef307b3c385b67dbab2ada58524a1bc71e4e312))

## 0.5.1 (2026-03-21)

### 🐛 Bug Fixes

- robust ingress auth and restore /apps/ links ([`1ec04eb3`](https://github.com/FaserF/hassio-addons/commit/1ec04eb3bebea8dcbf983d9d6340d303be6af7d7))
- resolve linting and formatting issues across addons ([`e0aa8bfc`](https://github.com/FaserF/hassio-addons/commit/e0aa8bfc74561c7a8365c4915bed108d882bce8f))

### 📦 Dependencies

- update home-assistant.io/addons/ to /apps/ and remove ignore ([`35318ec8`](https://github.com/FaserF/hassio-addons/commit/35318ec8f6d1c5be470aace8f13a1ac617fd9b85))
- Update README information with support info ([`c70fff01`](https://github.com/FaserF/hassio-addons/commit/c70fff01378d531e3dffc35dc2bf94b49237f541))

### 🚀 Other

- fix db reset ([`07da1eea`](https://github.com/FaserF/hassio-addons/commit/07da1eeab9b67b2c21fa73e5c07b1ff417243b49))
- Small new config options for AegisBot ([`1f34e963`](https://github.com/FaserF/hassio-addons/commit/1f34e963a791123b0c1c1d4ed44551e546800f00))
- make AegisBot app compatible with latest version ([`f6dec35b`](https://github.com/FaserF/hassio-addons/commit/f6dec35b14a4375ce307e011cbdc3962ee79b798))
- security & docs improvements codeql ([`a4a06f09`](https://github.com/FaserF/hassio-addons/commit/a4a06f09bab3956a81fe1dc81bf3ce991e3c83d1))
- small fixes & linter improvements ([`33150324`](https://github.com/FaserF/hassio-addons/commit/331503241aa11ccfb398a6cbf5b850aeec084ef2))
- replace basio addon with bashio apps ([`2caaf920`](https://github.com/FaserF/hassio-addons/commit/2caaf920939dbb61243d2ed1e8f63518a3199aa9))
- Linter fixes ([`5fa8fca4`](https://github.com/FaserF/hassio-addons/commit/5fa8fca4bfabea6d9334340f98ff57bb89ea9ed5))
- CI & Linter fixes ([`f14e1e62`](https://github.com/FaserF/hassio-addons/commit/f14e1e6259a33a82f6321be9a71b9b41b0e82ea2))
- Follow new Homeassistant Apps naming ([`a63066b1`](https://github.com/FaserF/hassio-addons/commit/a63066b111f275f9b359bf0e1cea3c49a14fb31c))
- Link fixes ([`80a29ecd`](https://github.com/FaserF/hassio-addons/commit/80a29ecd14061b993f8fcde6d8c1865d15cce14e))

## 0.5.0 (2026-01-29)

### 📦 Dependencies

- fix App startups after base image update 20.0.0 (#617) [skip-tests] ([`04c90f6d`](https://github.com/FaserF/hassio-addons/commit/04c90f6d2ea1a75af00b8f6d80ed170271f144d1))

### 📝 Documentation

- Readme improvements ([`8a12ebd4`](https://github.com/FaserF/hassio-addons/commit/8a12ebd40149adb39f056b7dc3e10f1dd02853cb))

### 🚀 Other

- fix log level var ([`7f85096a`](https://github.com/FaserF/hassio-addons/commit/7f85096a73b11ea48fa87150def32425ea1e4807))
- standardized log level handling between Apps ([`cf4bc264`](https://github.com/FaserF/hassio-addons/commit/cf4bc264edca7956fb4ae13ae76b22c8c5afafac))

## 0.4.1 (2026-01-14)

### 🚀 Other

- fixed logo in Homeassistant App UI ([`f053f7b0`](https://github.com/FaserF/hassio-addons/commit/f053f7b0b0c43df32e122ba054ba6118379ab959))
- small fixes & improvements ([`ce7a62e4`](https://github.com/FaserF/hassio-addons/commit/ce7a62e43eb50c87458588df6581b8ed3a741c9d))
- New/improved log level option ([`73d8e254`](https://github.com/FaserF/hassio-addons/commit/73d8e254b10e01aaffc474d22192d2b8deea4c79))

## 0.4.0 (2026-01-11)

### 🎨 Style

- auto-fix (shfmt,black,isort,prettier,markdownlint) ([`cdc7143c`](https://github.com/FaserF/hassio-addons/commit/cdc7143ca2531fdf41778e43e852faee4cd49880))

### 🚀 Other

- CI fixes ([`4e31bcdc`](https://github.com/FaserF/hassio-addons/commit/4e31bcdc3025f30797b5ce1f0b220d06b22db35f))
- New/improved log level option ([`73d8e254`](https://github.com/FaserF/hassio-addons/commit/73d8e254b10e01aaffc474d22192d2b8deea4c79))

### 📌 Release Note

- new db reset option & log level improved/added

## 0.3.5 (2026-01-10)

### 🎨 Style

- auto-fix (shfmt,black,isort,prettier,markdownlint) ([`b8c86b04`](https://github.com/FaserF/hassio-addons/commit/b8c86b04f6c1aa1763bf7c7c57072bd2b7591b10))

### 📌 Release Note

- general background fixes and stability improvements

## 0.3.4 (2026-01-10)

### 🎨 Style

- auto-fix (shfmt,black,isort,prettier,markdownlint) ([`ad9c556b`](https://github.com/FaserF/hassio-addons/commit/ad9c556bd9738f7ed077b08e2fbbf19a17acc342))

### 🚀 Other

- CI fixes ([`97345da9`](https://github.com/FaserF/hassio-addons/commit/97345da944580528955f6e0d0263cd86e2c27cc4))

### 📌 Release Note

- general App improvements & startup fixes

## 0.3.3 (2026-01-09)

### 📦 Dependencies

- 🚀 release(n8n): version bump [skip-tests] ([`09fb196`](https://github.com/FaserF/hassio-addons/commit/09fb1968338774fcd193caa4e33f80a7cb5cad81))

### 📌 Release Note

- bug fixes and startup improvements

## 0.3.2 (2026-01-09)

### 🎨 Style

- auto-fix (shfmt,black,isort,prettier,markdownlint) ([`72718f5`](https://github.com/FaserF/hassio-addons/commit/72718f5cfc149f65ec936797326b6782ef996461))

### 📌 Release Note

- General App structure improvements and startup bug fixes

## 0.3.1 (2026-01-08)

## 0.3.0 (2026-01-06)

### 📦 Dependencies

- Update run.sh ([`b3fc648`](https://github.com/FaserF/hassio-addons/commit/b3fc648923c63183c25fd720abd47c88112bc5b3))

### 📌 Release Note

- Manual release via Orchestrator

## 0.2.0 (2026-01-03)

🎉 **Happy New Year 2026!** 🎉

### 🎉 Major Release - Unified App Update

All Apps have been unified, updated, and many bugs have been fixed. Many Apps have been partially or completely rewritten to improve stability, performance, and maintainability.

#### Important Information

- **Edge Branch (Beta)**: A new `edge` branch is now available for those who want to test the latest features and improvements before they are released to the stable channel.
- **Unsupported Branch**: A new `unsupported` branch has been created for Apps that no longer receive direct manual support. These Apps are still maintained but may have limited support compared to the main Apps.
- **Bug Reports**: If you encounter any new issues, please report them on GitHub as usual. Your feedback helps us improve the Apps.

This release represents a significant effort to standardize and improve all Apps in the repository.

---

### 📦 Dependencies

- Update orchestrator-release.yaml ([`4774494`](https://github.com/FaserF/hassio-addons/commit/477449414ddf817f9297c2ac38ade8009b69ae12))

### 📋 Major Release - Changes

- **Bug Reports**: If you encounter any new issues, please report them on GitHub as usual. Your feedback helps us improve the Apps. (Manual)
- **Unsupported Branch**: A new `unsupported` branch has been created for Apps that no longer receive direct manual support. These Apps are still maintained but may have limited support compared to the main Apps. (Manual)
- **Edge Branch (Beta)**: A new `edge` branch is now available for those who want to test the latest features and improvements before they are released to the stable channel. (Manual)

### 📌 Release Note

- Manual release via Orchestrator
