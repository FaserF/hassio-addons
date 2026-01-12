# Changelog

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

- auto-fix (shfmt,black,isort,prettier,markdownlint) ([`33ae28f8`](https://github.com/FaserF/hassio-addons/commit/33ae28f8207916318cc9a4e306c6b460e771c809))

### 🚀 Other

- CI fixes ([`97345da9`](https://github.com/FaserF/hassio-addons/commit/97345da944580528955f6e0d0263cd86e2c27cc4))
- more addon fixes ([`4caaec4b`](https://github.com/FaserF/hassio-addons/commit/4caaec4b6ea5d3eb5be2829e0d2f941c37b8e7f3))
- more addon fixes ([`070c421a`](https://github.com/FaserF/hassio-addons/commit/070c421a5d01917939f6b0a37eb7e62a1e0c5c17))

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

- 📝 release(apache2-minimal): update changelog [skip-tests] ([`476e2f5`](https://github.com/FaserF/hassio-addons/commit/476e2f5ff7c65d67eb19d251f2d3fa778cc15f2f))

### 📋 Major Release - Changes (Continued)

- **Bug Reports**: If you encounter any new issues, please report them on GitHub as usual. Your feedback helps us improve the addons. (Manual)
- **Unsupported Branch**: A new `unsupported` branch has been created for addons that no longer receive direct manual support. These addons are still maintained but may have limited support compared to the main addons. (Manual)
- **Edge Branch (Beta)**: A new `edge` branch is now available for those who want to test the latest features and improvements before they are released to the stable channel. (Manual)

### 📌 Release Note

- Manual release via Orchestrator

## 1.7.2 (2026-01-03)

- Bump version to 1.7.2

## 1.7.1

- Automatically updated addon-base to version v19.0.0

## 1.7.0

- Automatically updated addon-base to version v19.0.0
- Drop support for armhf, armv7, and i386 systems

## 1.6.10

- Test

## 1.6.9

- Automatically updated addon-base to version v18.2.1

## 1.6.8

- fix unable to exec bashio

## 1.6.7

- Bump python-tado to v0.19.2

## 1.6.6

- Fixed an error while updating / installing the latest version
  - This happened due to a faulty image building process
  - Since this issue has been in the last few updates, I have stopped the
    automatic update and release workflow for now

## 1.6.5

- Automatically updated addon-base to version v17.2.5

## 1.6.4

- Automatically updated addon-base to version v17.2.2

## 1.6.3

- Automatically updated addon-base to version v17.2.1

## 1.6.2

- Automatically updated addon-base to version v17.2.1

## 1.6.1

- enabled the usage of own GitHub images

## 1.6.0

- Prepared using own GitHub image for backups & addon building
  -> This lowers the backup sizes for this addon
  -> Not yet activated, only everything has been prepared

## 1.5.6

- Automatically updated addon-base to version v17.2.1

## 1.5.5

- automatically update addon-base to version v17.0.1

## 1.5.4

- automatically update addon-base to version v17.0.0

## 1.5.3

- automatically update addon-base to version v16.3.6

## 1.5.2

- automatically update addon-base to version v16.3.5

## 1.5.1

- automatically update addon-base to version v16.3.4

## 1.5.0

- automatically update addon-base to version v16.3.3

## 1.4.9

- automatically update addon-base to version v16.3.2

## 1.4.8

- automatically update addon-base to version v16.3.1

## 1.4.7

- automatically update addon-base to version v16.3.0

## 1.4.6

- automatically update addon-base to version v16.2.1

## 1.4.5

- automatically update addon-base to version v16.1.3

## 1.4.3

- display more terminal output by default
- new log_level option

## 1.4.2

- automatically update addon-base to version v16.0.0

## 1.4.1

- bump hassio-addon-base to version v15.0.8

## 1.4.0

- update hassio-addon-base to version v15.0.4
- bump python-tado to version 0.17.3
- Switch python to venv to allow pip moduls on newer addon base version

## 1.3.9

- fix min & maxtemp options in GUI and config file
- this fixes that new users could not see the addon
- automatically update hassio-addon-base to version v14.3.2

## 1.3.8

- Fix: Do not allow unsupported min/max temp values
- update tado_aa python module to the latest version

## 1.3.7

- automatically update hassio-addon-base to version v14.3.1

## 1.3.6

- automatically update hassio-addon-base to version v14.2.2

## 1.3.5

- automatically update hassio-addon-base to version v14.1.3

## 1.3.4

- automatically update hassio-addon-base to version v14.0.8

## 1.3.3

- automatically update hassio-addon-base to version v14.0.8

## 1.3.2

- automatically update hassio-addon-base to the latest version

## 1.3.1

- automatically update hassio-addon-base to the latest version

## 1.3.0

- bump hassio-addon-base to V14.0.0
- autorelease new version updates on addon base updates
- auto bump dependency updates for tado-aa python module

## 1.2.0

- bump hassio-addon-base to the latest version
- update tado-aa python module
- new feature: define min temp
- new feature: define max temp

## 1.1.0

- Bump Addon Base to V10.0.0

## 1.0.1

- Implement new username password detection from base python source

## 1.0.0

- Initial release
