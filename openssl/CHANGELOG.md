# Changelog

## 2.3.0 (2026-01-29)

### 📦 Dependencies

- fix addon startups after base image update 20.0.0 (#617) [skip-tests] ([`04c90f6d`](https://github.com/FaserF/hassio-addons/commit/04c90f6d2ea1a75af00b8f6d80ed170271f144d1))
- ⬆️ Update ghcr.io/hassio-addons/base Docker tag to v[20.0.1](https://github.com/hassio-addons/addon-base/releases/tag/20.0.1) [skip-tests] (#618) ([`62a7ed57`](https://github.com/FaserF/hassio-addons/commit/62a7ed5794451961add1f8ec065f5cbe863d1623))
- ⬆️ Update ghcr.io/hassio-addons/base Docker tag to v20 [skip-tests] (#616) ([`09e8340b`](https://github.com/FaserF/hassio-addons/commit/09e8340b06c4263037fab6cf6d90fc913c7f99d5))

### 📝 Documentation

- Readme improvements ([`8a12ebd4`](https://github.com/FaserF/hassio-addons/commit/8a12ebd40149adb39f056b7dc3e10f1dd02853cb))

## 2.2.1 (2026-01-14)

### 🚀 Other

- fixed logo in Homeassistant Addon UI ([`f053f7b0`](https://github.com/FaserF/hassio-addons/commit/f053f7b0b0c43df32e122ba054ba6118379ab959))
- small fixes & improvements ([`ce7a62e4`](https://github.com/FaserF/hassio-addons/commit/ce7a62e43eb50c87458588df6581b8ed3a741c9d))
- New/improved log level option ([`73d8e254`](https://github.com/FaserF/hassio-addons/commit/73d8e254b10e01aaffc474d22192d2b8deea4c79))

## 2.2.0 (2026-01-11)

### 🎨 Style

- auto-fix (shfmt,black,isort,prettier,markdownlint) ([`1838d16f`](https://github.com/FaserF/hassio-addons/commit/1838d16fd800bde467c70b033ad03e9e600e2891))
- auto-fix (shfmt,black,isort,prettier,markdownlint) ([`cdc7143c`](https://github.com/FaserF/hassio-addons/commit/cdc7143ca2531fdf41778e43e852faee4cd49880))

### 🚀 Other

- more CI fixes & addon db reset improvements ([`fc27cc3b`](https://github.com/FaserF/hassio-addons/commit/fc27cc3bee4a9a34fd573f38e870ff921b3f7d3d))
- CI fixes ([`4e31bcdc`](https://github.com/FaserF/hassio-addons/commit/4e31bcdc3025f30797b5ce1f0b220d06b22db35f))
- New/improved log level option ([`73d8e254`](https://github.com/FaserF/hassio-addons/commit/73d8e254b10e01aaffc474d22192d2b8deea4c79))

### 📌 Release Note

- new db reset option & log level improved/added

## 2.1.4 (2026-01-10)

### 🎨 Style

- auto-fix (shfmt,black,isort,prettier,markdownlint) ([`b8c86b04`](https://github.com/FaserF/hassio-addons/commit/b8c86b04f6c1aa1763bf7c7c57072bd2b7591b10))

### 📌 Release Note

- general background fixes and stability improvements

## 2.1.3 (2026-01-10)

### 🎨 Style

- auto-fix (shfmt,black,isort,prettier,markdownlint) ([`c22433eb`](https://github.com/FaserF/hassio-addons/commit/c22433ebd6a5336875755cd16b7b9e0e3564a1aa))

### 🚀 Other

- CI fixes ([`97345da9`](https://github.com/FaserF/hassio-addons/commit/97345da944580528955f6e0d0263cd86e2c27cc4))

### 📌 Release Note

- general addon improvements & startup fixes

## 2.1.2 (2026-01-09)

### 📦 Dependencies

- 🚀 release(n8n): version bump [skip-tests] ([`09fb196`](https://github.com/FaserF/hassio-addons/commit/09fb1968338774fcd193caa4e33f80a7cb5cad81))

### 📌 Release Note

- bug fixes and startup improvements

## 2.1.1 (2026-01-09)

### 🎨 Style

- auto-fix (shfmt,black,isort,prettier,markdownlint) ([`72718f5`](https://github.com/FaserF/hassio-addons/commit/72718f5cfc149f65ec936797326b6782ef996461))

### 📌 Release Note

- General addon structure improvements and startup bug fixes

## 2.1.0 (2026-01-06)

### 📦 Dependencies

- Update run.sh ([`b3fc648`](https://github.com/FaserF/hassio-addons/commit/b3fc648923c63183c25fd720abd47c88112bc5b3))

### 📌 Release Note

- Manual release via Orchestrator

## 2.0.0 (2026-01-03)

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

- 📝 release(apache2-minimal): update changelog [skip-tests] ([`bb9feed`](https://github.com/FaserF/hassio-addons/commit/bb9feed1d85cbb4f602c85fed4846f536129ec69))

### 📋 Major Release - Changes

- **Bug Reports**: If you encounter any new issues, please report them on GitHub as usual. Your feedback helps us improve the addons. (Manual)
- **Unsupported Branch**: A new `unsupported` branch has been created for addons that no longer receive direct manual support. These addons are still maintained but may have limited support compared to the main addons. (Manual)
- **Edge Branch (Beta)**: A new `edge` branch is now available for those who want to test the latest features and improvements before they are released to the stable channel. (Manual)

### 📌 Release Note

- Manual release via Orchestrator
