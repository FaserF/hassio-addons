# Changelog

## 2.3.1-dev-c70fff0 (2026-02-22)

### 📦 Dependencies
- Update README information with support info ([`c70fff01`](https://github.com/FaserF/hassio-addons/commit/c70fff01378d531e3dffc35dc2bf94b49237f541))

### 🚀 Other
- small fixes & linter improvements ([`33150324`](https://github.com/FaserF/hassio-addons/commit/331503241aa11ccfb398a6cbf5b850aeec084ef2))
- replace basio addon with bashio apps ([`2caaf920`](https://github.com/FaserF/hassio-addons/commit/2caaf920939dbb61243d2ed1e8f63518a3199aa9))
- Linter fixes ([`5fa8fca4`](https://github.com/FaserF/hassio-addons/commit/5fa8fca4bfabea6d9334340f98ff57bb89ea9ed5))
- CI & Linter fixes ([`f14e1e62`](https://github.com/FaserF/hassio-addons/commit/f14e1e6259a33a82f6321be9a71b9b41b0e82ea2))
- Follow new Homeassistant Apps naming ([`a63066b1`](https://github.com/FaserF/hassio-addons/commit/a63066b111f275f9b359bf0e1cea3c49a14fb31c))
- Link fixes ([`80a29ecd`](https://github.com/FaserF/hassio-addons/commit/80a29ecd14061b993f8fcde6d8c1865d15cce14e))


## 2.3.0 (2026-01-29)

### 📦 Dependencies

- fix App startups after base image update 20.0.0 (#617) [skip-tests] ([`04c90f6d`](https://github.com/FaserF/hassio-addons/commit/04c90f6d2ea1a75af00b8f6d80ed170271f144d1))
- ⬆️ Update ghcr.io/hassio-addons/base Docker tag to v[20.0.1](https://github.com/hassio-addons/App-base/releases/tag/20.0.1) [skip-tests] (#618) ([`62a7ed57`](https://github.com/FaserF/hassio-addons/commit/62a7ed5794451961add1f8ec065f5cbe863d1623))
- ⬆️ Update ghcr.io/hassio-addons/base Docker tag to v20 [skip-tests] (#616) ([`09e8340b`](https://github.com/FaserF/hassio-addons/commit/09e8340b06c4263037fab6cf6d90fc913c7f99d5))

### 📝 Documentation

- Readme improvements ([`8a12ebd4`](https://github.com/FaserF/hassio-addons/commit/8a12ebd40149adb39f056b7dc3e10f1dd02853cb))

### 🚀 Other

- fix log level var ([`7f85096a`](https://github.com/FaserF/hassio-addons/commit/7f85096a73b11ea48fa87150def32425ea1e4807))

## 2.2.1 (2026-01-14)

### 🚀 Other

- fixed logo in Homeassistant App UI ([`f053f7b0`](https://github.com/FaserF/hassio-addons/commit/f053f7b0b0c43df32e122ba054ba6118379ab959))
- small fixes & improvements ([`ce7a62e4`](https://github.com/FaserF/hassio-addons/commit/ce7a62e43eb50c87458588df6581b8ed3a741c9d))
- handle empty log level variable ([`568bbe5b`](https://github.com/FaserF/hassio-addons/commit/568bbe5bce289563264d87f55e8da35b9d508041))
- New/improved log level option ([`73d8e254`](https://github.com/FaserF/hassio-addons/commit/73d8e254b10e01aaffc474d22192d2b8deea4c79))

## 2.2.0 (2026-01-11)

### 🚀 Other

- ✨ Feature: New/improved log level option ([`73d8e254`](https://github.com/FaserF/hassio-addons/commit/73d8e254b10e01aaffc474d22192d2b8deea4c79))
- 🐛 Fix: Handle empty log level variable ([`568bbe5b`](https://github.com/FaserF/hassio-addons/commit/568bbe5bce289563264d87f55e8da35b9d508041))
- CI improvements and App db reset fixes ([`fc27cc3b`](https://github.com/FaserF/hassio-addons/commit/fc27cc3bee4a9a34fd573f38e870ff921b3f7d3d), [`4e31bcdc`](https://github.com/FaserF/hassio-addons/commit/4e31bcdc3025f30797b5ce1f0b220d06b22db35f))

### 📌 Release Note

- new db reset option & log level improved/added

## 2.1.4 (2026-01-10)

### 📌 Release Note

- general background fixes and stability improvements

## 2.1.3 (2026-01-10)

### 🚀 Other

- CI fixes ([`97345da9`](https://github.com/FaserF/hassio-addons/commit/97345da944580528955f6e0d0263cd86e2c27cc4))

### 📌 Release Note

- general App improvements & startup fixes

## 2.1.2 (2026-01-09)

### 📦 Dependencies

### 📌 Release Note

- bug fixes and startup improvements

## 2.1.1 (2026-01-09)

### 📌 Release Note

- General App structure improvements and startup bug fixes

## 2.1.0 (2026-01-06)

### 📦 Dependencies

- Update run.sh ([`b3fc648`](https://github.com/FaserF/hassio-addons/commit/b3fc648923c63183c25fd720abd47c88112bc5b3))

### 📌 Release Note

- Manual release via Orchestrator

## 2.0.0 (2026-01-03)

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
