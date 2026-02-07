# Changelog

## 3.3.0 (2026-01-29)

### 📦 Dependencies

- fix App startups after base image update 20.0.0 (#617) [skip-tests] ([`04c90f6d`](https://github.com/FaserF/hassio-addons/commit/04c90f6d2ea1a75af00b8f6d80ed170271f144d1))
- ⬆️ Update ghcr.io/hassio-addons/base Docker tag to v[20.0.1](https://github.com/hassio-addons/App-base/releases/tag/20.0.1) [skip-tests] (#618) ([`62a7ed57`](https://github.com/FaserF/hassio-addons/commit/62a7ed5794451961add1f8ec065f5cbe863d1623))
- ⬆️ Update ghcr.io/hassio-addons/base Docker tag to v20 [skip-tests] (#616) ([`09e8340b`](https://github.com/FaserF/hassio-addons/commit/09e8340b06c4263037fab6cf6d90fc913c7f99d5))

### 📝 Documentation

- Readme improvements ([`8a12ebd4`](https://github.com/FaserF/hassio-addons/commit/8a12ebd40149adb39f056b7dc3e10f1dd02853cb))

### 🚀 Other

- fix log level var ([`7f85096a`](https://github.com/FaserF/hassio-addons/commit/7f85096a73b11ea48fa87150def32425ea1e4807))
- standardized log level handling between Apps ([`cf4bc264`](https://github.com/FaserF/hassio-addons/commit/cf4bc264edca7956fb4ae13ae76b22c8c5afafac))

## 3.2.1 (2026-01-14)

### 🚀 Other

- fix /media access for apache2 #583 ([`2ef9e134`](https://github.com/FaserF/hassio-addons/commit/2ef9e134882919bc263954438e8c279a75eb2532))
- fixed logo in Homeassistant App UI ([`f053f7b0`](https://github.com/FaserF/hassio-addons/commit/f053f7b0b0c43df32e122ba054ba6118379ab959))
- small fixes & improvements ([`ce7a62e4`](https://github.com/FaserF/hassio-addons/commit/ce7a62e43eb50c87458588df6581b8ed3a741c9d))
- New/improved log level option ([`73d8e254`](https://github.com/FaserF/hassio-addons/commit/73d8e254b10e01aaffc474d22192d2b8deea4c79))
- small fixes ([`60c5ddf4`](https://github.com/FaserF/hassio-addons/commit/60c5ddf4fede8242031082aa8e7fa0d057c0087f))

## 3.2.0 (2026-01-11)

### 🎨 Style

- auto-fix (shfmt,black,isort,prettier,markdownlint) ([`1838d16f`](https://github.com/FaserF/hassio-addons/commit/1838d16fd800bde467c70b033ad03e9e600e2891))
- auto-fix (shfmt,black,isort,prettier,markdownlint) ([`cdc7143c`](https://github.com/FaserF/hassio-addons/commit/cdc7143ca2531fdf41778e43e852faee4cd49880))

### ✨ Features

- New/improved log level option ([`73d8e254`](https://github.com/FaserF/hassio-addons/commit/73d8e254b10e01aaffc474d22192d2b8deea4c79))

### 🚀 Other

- Improved database reset logic and resolved CI pipeline issues ([`fc27cc3b`](https://github.com/FaserF/hassio-addons/commit/fc27cc3bee4a9a34fd573f38e870ff921b3f7d3d))
- Resolved CI workflow deployment errors ([`4e31bcdc`](https://github.com/FaserF/hassio-addons/commit/4e31bcdc3025f30797b5ce1f0b220d06b22db35f))

### 📌 Release Note

- new db reset option & log level improved/added

## 3.1.4 (2026-01-10)

### 🎨 Style

- auto-fix (shfmt,black,isort,prettier,markdownlint) ([`b8c86b04`](https://github.com/FaserF/hassio-addons/commit/b8c86b04f6c1aa1763bf7c7c57072bd2b7591b10))

### 🚀 Other

- General maintenance and configuration refinements ([`60c5ddf4`](https://github.com/FaserF/hassio-addons/commit/60c5ddf4fede8242031082aa8e7fa0d057c0087f))

### 📌 Release Note

- general background fixes and stability improvements

## 3.1.3 (2026-01-10)

### 🎨 Style

- auto-fix (shfmt,black,isort,prettier,markdownlint) ([`ad9c556b`](https://github.com/FaserF/hassio-addons/commit/ad9c556bd9738f7ed077b08e2fbbf19a17acc342))

### 🚀 Other

- Fixed CI build pipeline issues ([`97345da9`](https://github.com/FaserF/hassio-addons/commit/97345da944580528955f6e0d0263cd86e2c27cc4))

### 📌 Release Note

- general App improvements & startup fixes

## 3.1.2 (2026-01-09)

### 📦 Dependencies

- 🚀 release(n8n): version bump [skip-tests] ([`09fb196`](https://github.com/FaserF/hassio-addons/commit/09fb1968338774fcd193caa4e33f80a7cb5cad81))

### 📌 Release Note

- bug fixes and startup improvements

## 3.1.1 (2026-01-09)

### 🎨 Style

- auto-fix (shfmt,black,isort,prettier,markdownlint) ([`72718f5`](https://github.com/FaserF/hassio-addons/commit/72718f5cfc149f65ec936797326b6782ef996461))

### 📌 Release Note

- General App structure improvements and startup bug fixes

## 3.1.0 (2026-01-06)

### 📦 Dependencies

- Update run.sh ([`b3fc648`](https://github.com/FaserF/hassio-addons/commit/b3fc648923c63183c25fd720abd47c88112bc5b3))

### 📌 Release Note

- Manual release via Orchestrator

## 3.0.0 (2026-01-03)

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
