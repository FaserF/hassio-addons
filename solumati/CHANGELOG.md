# Changelog

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

- Update orchestrator-release.yaml ([`4774494`](https://github.com/FaserF/hassio-addons/commit/477449414ddf817f9297c2ac38ade8009b69ae12))

### 📋 Major Release - Changes

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
