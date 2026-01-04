# Changelog

## 2.0.1-dev-4fc7754 (2026-01-04)

### 🐛 Bug Fixes
- rename README.MD to README.md and prevent run.sh startup crashes ([`4fc77546`](https://github.com/FaserF/hassio-addons/commit/4fc775469d5aec6dd85ac55e71ffff56388b7228))

### 📦 Dependencies
- 📝 release(solumati): update changelog [skip-tests] ([`d03d3888`](https://github.com/FaserF/hassio-addons/commit/d03d3888dd1104f8a3230ab59be67964330fbb68))
- 📝 release(solumati): update changelog [skip-tests] ([`0fe7ebd2`](https://github.com/FaserF/hassio-addons/commit/0fe7ebd2bd2ae642a5cda3d150a38b57241dceeb))
- Bump all addon versions ([`7a5426ba`](https://github.com/FaserF/hassio-addons/commit/7a5426bac78e1dbbbf0de477757cbe4562594434))
- bump all addons to dev version [skip-tests] ([`212568b0`](https://github.com/FaserF/hassio-addons/commit/212568b0343b757b6cd3ab18513949aa41f5d511))

### 🔧 Configuration
- revert master branch to stable versions (removed -dev suffixes) ([`4f35d8ad`](https://github.com/FaserF/hassio-addons/commit/4f35d8ad59ba6f04a4360ace09024eb7bbb459cd))

### 📝 Documentation
- improved READMEs ([`083b3025`](https://github.com/FaserF/hassio-addons/commit/083b30254f65656f616671ec8aa6649cbe085b8e))

### 🎨 Style
- auto-fix (prettier,markdownlint) ([`073bc2d2`](https://github.com/FaserF/hassio-addons/commit/073bc2d241297edab9de99d8f4a4e194d0235297))
- auto-fix (black,isort,prettier,markdownlint) ([`17a41a4c`](https://github.com/FaserF/hassio-addons/commit/17a41a4ce0f7715a8d615267081aeed2e35db028))
- auto-fix (shfmt,black,isort,prettier,markdownlint) ([`306affa9`](https://github.com/FaserF/hassio-addons/commit/306affa9d554d45d31949a56d1b1d488b4a63c87))

### 🚀 Other
- small fix ([`4de506d9`](https://github.com/FaserF/hassio-addons/commit/4de506d97842d06151ae7fbb437d62669a70eb48))
- Docs improvements ([`9ba3343c`](https://github.com/FaserF/hassio-addons/commit/9ba3343c174fc850b55a9d73117eb57476b9d5cb))
- small addon fixes ([`f3f3e0f5`](https://github.com/FaserF/hassio-addons/commit/f3f3e0f56b1c3fb6e8a44e396592b6177dd9c769))
- fix Addon startup ([`7a83fd1c`](https://github.com/FaserF/hassio-addons/commit/7a83fd1cf7e004cd117e2372f51880fde076f4dc))
- fixed addon startup issues ([`29ed9ca8`](https://github.com/FaserF/hassio-addons/commit/29ed9ca8cc9312be4fe346d2674cb333c0a59859))
- fix banner printing ([`de18e9e2`](https://github.com/FaserF/hassio-addons/commit/de18e9e2fec69ebd2a73139670d5bc6f858b8e75))
- Fixes for Addon start issues ([`c34d7b58`](https://github.com/FaserF/hassio-addons/commit/c34d7b585d4d6f377d7d44803833e0d612b59120))
- CI fixes ([`14f1fcc9`](https://github.com/FaserF/hassio-addons/commit/14f1fcc960642877f7dfd6a7c1f4c8eb54d1ede4))
- CI fixes ([`331993f0`](https://github.com/FaserF/hassio-addons/commit/331993f0bbadd692534dac26b509dc62a12b81b2))
- more CI fixes ([`e701f245`](https://github.com/FaserF/hassio-addons/commit/e701f245f347f2fcd73ab63ccb5eb04ab58590df))


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
- Update orchestrator-release.yaml ([`4774494`](https://github.com/FaserF/hassio-addons/commit/477449414ddf817f9297c2ac38ade8009b69ae12))

### 🎉 Major Release - Unified Addon Update
- **Bug Reports**: If you encounter any new issues, please report them on GitHub as usual. Your feedback helps us improve the addons. (Manual)
- **Unsupported Branch**: A new `unsupported` branch has been created for addons that no longer receive direct manual support. These addons are still maintained but may have limited support compared to the main addons. (Manual)
- **Edge Branch (Beta)**: A new `edge` branch is now available for those who want to test the latest features and improvements before they are released to the stable channel. (Manual)

### 📌 Release Note
- Manual release via Orchestrator


## 1.5.11

- General addon improvements

## 1.5.9

- Automatically updated Solumati to version v2025.12.3b1

## 1.5.8

- Improved build script robustness: now checks for `vite.config.ts` or
  `vite.config.js` automatically.
- Enhanced API URL replacement to handle different syntax variations.

## 1.5.7

- Fixed connection refused error by correcting build script to target `vite.config.ts`.
- Fixed API URL replacement in frontend config.

## 1.5.6

- Automatically updated Solumati to version v2025.12.3b1

## 1.5.5

- Fixed build error by targeting correct `vite.config.js` filename.

## 1.5.4

- Switched to local build (removed pre-built image dependency)

## 1.5.3

- Improved Ingress support with relative paths and dynamic port handling

## 1.5.2

- Automatically updated Solumati to version vv2025.12.3b0

## 1.5.1

- Updated Solumati to vv2025.12.3b0

## 1.5.0

- Updated Solumati to v2025.12.2-b6
- new dev option to use main branch

## 1.4.4

- Updated Solumati to v2025.12.2-b5

## 1.4.3

- Updated Solumati to v2025.12.2-b4
- **NEW**: Enable Marketing Page Option

## 1.4.1

- **NEW**: Factory Reset option (⚠️ Danger Zone) - Completely wipes all data (database, images, settings) - 5-second delay before reset to allow cancellation - Must be manually disabled after reset
- **REMOVED**: OAuth/project_name options (these are configured in Admin Panel,
  not env vars)
- Updated documentation with factory reset warnings
- Updated Solumati to v2025.12.2-b3

## 1.4.0

- **NEW**: Home Assistant Ingress support (secure sidebar access)
- **NEW**: Configurable options in HA UI: - `app_base_url` - Auto-detected from Ingress or manually set - `project_name` - Custom app name - `github_client_id` - GitHub OAuth - `google_client_id` - Google OAuth - `microsoft_client_id` - Microsoft OAuth
- Improved startup logging with environment info
- Updated documentation
- update Solumati to v2025.12.2-b2

## 1.3.14

- updated Solumati to v2025.12.1-b11

## 1.3.12

- updated Solumati to v2025.12.1-b10

## 1.3.10

- updated Solumati to v2025.12.1-b9

## 1.3.8

- updated Solumati to v2025.12.1-b8

## 1.3.6

- updated Solumati to v2025.12.1-b7

## 1.3.4

- updated Solumati to v2025.12.1-b6

## 1.3.2

- updated Solumati to v2025.12.1-b5

## 1.3.1

- updated Solumati to v2025.12.1-b4

## 1.2.0

- New features
- Bug fixes

## 1.1.0

- New features
- Bug fixes

## 1.0.0

- Initial release
