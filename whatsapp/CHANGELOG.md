# Changelog

## 0.5.1 (2026-01-14)

### 📦 Dependencies
- Update config.yaml ([`84b34d5d`](https://github.com/FaserF/hassio-addons/commit/84b34d5db8f6f9c6f73e4bbe2adabd63e4cdd5ba))
- ⬆️ Update dependency pino to v10.1.1 [skip-tests] ([`dd003e4c`](https://github.com/FaserF/hassio-addons/commit/dd003e4cb760e9e838268a24b7037aaeaba016a5))

### 🚀 Other
- fixed logo in Homeassistant Addon UI ([`f053f7b0`](https://github.com/FaserF/hassio-addons/commit/f053f7b0b0c43df32e122ba054ba6118379ab959))
- small fixes & improvements ([`ce7a62e4`](https://github.com/FaserF/hassio-addons/commit/ce7a62e43eb50c87458588df6581b8ed3a741c9d))
- New/improved log level option ([`73d8e254`](https://github.com/FaserF/hassio-addons/commit/73d8e254b10e01aaffc474d22192d2b8deea4c79))
- small fixes ([`60c5ddf4`](https://github.com/FaserF/hassio-addons/commit/60c5ddf4fede8242031082aa8e7fa0d057c0087f))


## 0.5.0 (2026-01-11)

### 🎨 Style

### ✨ Features

- New/improved log level option ([`73d8e254`](https://github.com/FaserF/hassio-addons/commit/73d8e254b10e01aaffc474d22192d2b8deea4c79))

### 🚀 Other

- more CI fixes & addon db reset improvements ([`fc27cc3b`](https://github.com/FaserF/hassio-addons/commit/fc27cc3bee4a9a34fd573f38e870ff921b3f7d3d))

### 📌 Release Note

- new db reset option & log level improved/added

## 0.4.4 (2026-01-10)

### 📦 Dependencies

- Update config.yaml with new log level options ([`84b34d5d`](https://github.com/FaserF/hassio-addons/commit/84b34d5db8f6f9c6f73e4bbe2adabd63e4cdd5ba))

### 🎨 Style

### 🚀 Other

- General background fixes ([`60c5ddf4`](https://github.com/FaserF/hassio-addons/commit/60c5ddf4fede8242031082aa8e7fa0d057c0087f))

### 📌 Release Note

- general background fixes and stability improvements

## 0.4.3 (2026-01-10)

### 📦 Dependencies

- ⬆️ Update dependency pino to v10.1.1 [skip-tests] ([`dd003e4c`](https://github.com/FaserF/hassio-addons/commit/dd003e4cb760e9e838268a24b7037aaeaba016a5))

### 🎨 Style

### 📌 Release Note

- general addon improvements & startup fixes

## 0.4.2 (2026-01-09)

### 📦 Dependencies

### 📌 Release Note

- bug fixes and startup improvements

## 0.4.1 (2026-01-09)

### 🎨 Style

### 📌 Release Note

- General addon structure improvements and startup bug fixes

## 0.4.0 (2026-01-06)

### 📦 Dependencies

- Update run.sh ([`b3fc648`](https://github.com/FaserF/hassio-addons/commit/b3fc648923c63183c25fd720abd47c88112bc5b3))

### 📌 Release Note

- Manual release via Orchestrator

## 0.3.0 (2026-01-03)

🎉 **Happy New Year 2026!** 🎉

### 🎉 Major Release - Unified Addon Update

All addons have been unified, updated, and many bugs have been fixed. Many addons have been partially or completely rewritten to improve stability, performance, and maintainability.

#### Important Information

- **Edge Branch (Beta)**: A new `edge` branch is now available for those who want to test the latest features and improvements before they are released to the stable channel.
- **Unsupported Branch**: A new `unsupported` branch has been created for addons that no longer receive direct manual support. These addons are still maintained but may have limited support compared to the main addons.
- **Bug Reports**: If you encounter any new issues, please report them on GitHub as usual. Your feedback helps us improve the addons.

This release represents a significant effort to standardize and improve all addons in the repository.

---

### 📦 Dependencies

- 📝 release(apache2-minimal): update changelog [skip-tests] ([`476e2f5`](https://github.com/FaserF/hassio-addons/commit/476e2f5ff7c65d67eb19d251f2d3fa778cc15f2f))

### 📋 Major Release - Changes

- **Bug Reports**: If you encounter any new issues, please report them on GitHub as usual. Your feedback helps us improve the addons. (Manual)
- **Unsupported Branch**: A new `unsupported` branch has been created for addons that no longer receive direct manual support. These addons are still maintained but may have limited support compared to the main addons. (Manual)
- **Edge Branch (Beta)**: A new `edge` branch is now available for those who want to test the latest features and improvements before they are released to the stable channel. (Manual)

### 📌 Release Note

- Manual release via Orchestrator

## 0.2.0

- 🛠️ **Fix**: Ingress Dashboard now works correctly (trailing slash URL fix)
- 🛠️ **Fix**: Browser fingerprint consistency (macOS/Chrome)
- ⬆️ **Upgrade**: Baileys to 6.7.21 (latest v6)
- ✨ **New**: Debug logging in browser console for Ingress fetch calls

## 0.1.0

- ✨ **New**: Secured API with Token Authentication (Ingress & Integration)
- ✨ **New**: Ingress Dashboard with Status, API Token and Live QR Code
- ✨ **New**: Smart Discovery (Auto-detects Addon Hostname)
- ✨ **New**: Reset Session option in Integration
- 🛠️ **Fix**: Ingress Compatibility (Wildcard Routing, Relative Paths)
- 🛠️ **Fix**: Build & Startup Issues (Node 24, S6 Overlay)

## 0.0.2

- Upgrade to Node.js 24 (Alpine Edge)
- Convert backend to ESM (ES Modules)
- Full S6 Service Supervision (Platinum Standard)
- Change default port to 8066
- Fix Translation Errors
- Add Icons

## 0.0.1

- Initial Release (Baileys Backend)
