# Changelog

## 2.1.2 (2026-01-09)

### 📦 Dependencies

- 🚀 release(n8n): version bump [skip-tests] ([`09fb196`](https://github.com/FaserF/hassio-addons/commit/09fb1968338774fcd193caa4e33f80a7cb5cad81))

### 📌 Release Note

- bug fixes and startup improvements

## 2.1.1 (2026-01-09)

### 🎨 Style

- auto-fix (shfmt, black, isort, prettier, markdownlint) ([`72718f5`](https://github.com/FaserF/hassio-addons/commit/72718f5cfc149f65ec936797326b6782ef996461))

### 📌 Release Note

- General add-on structure improvements and startup bug fixes

## 2.1.0 (2026-01-06)

### 📦 Dependencies

- Update run.sh ([`b3fc648`](https://github.com/FaserF/hassio-addons/commit/b3fc648923c63183c25fd720abd47c88112bc5b3))

### 📌 Release Note

- Manual release via Orchestrator

## 2.0.0 (2026-01-03)

🎉 **Happy New Year 2026!** 🎉

### 🎉 Major Release - Unified Add-on Update

All add-ons have been unified, updated, and many bugs have been fixed. Many add-ons have been partially or completely rewritten to improve stability, performance, and maintainability.

#### Important Information

- **Edge Branch (Beta)**: A new `edge` branch is now available for those who want to test the latest features and improvements before they are released to the stable channel.
- **Unsupported Branch**: A new `unsupported` branch has been created for add-ons that no longer receive direct manual support. These add-ons are still maintained but may have limited support compared to the main add-ons.
- **Bug Reports**: If you encounter any new issues, please report them on GitHub as usual. Your feedback helps us improve the add-ons.

This release represents a significant effort to standardize and improve all add-ons in the repository.

---

### 📦 Dependencies

- Update orchestrator-release.yaml ([`4774494`](https://github.com/FaserF/hassio-addons/commit/477449414ddf817f9297c2ac38ade8009b69ae12))

### 📋 Major Release - Changes

- **Bug Reports**: If you encounter any new issues, please report them on GitHub as usual. Your feedback helps us improve the add-ons. (Manual)
- **Unsupported Branch**: A new `unsupported` branch has been created for add-ons that no longer receive direct manual support. These add-ons are still maintained but may have limited support compared to the main add-ons. (Manual)
- **Edge Branch (Beta)**: A new `edge` branch is now available for those who want to test the latest features and improvements before they are released to the stable channel. (Manual)

### 📌 Release Note

- Manual release via Orchestrator

## 1.0.15 (2026-01-03)

- Bump version to 1.0.15

## 1.0.14

- Added support for multiple users via list format in configuration.
- **Breaking Change**: The `username` and `password` options have been replaced by the `users` list.
- Improved documentation with multi-user examples.

## 1.0.13

- Fixed `filebrowser users update` syntax error ("accepts 1 arg, received 2").
- Now correctly uses `--password` flag for updates.

## 1.0.12

- Changed Dockerfile `ENTRYPOINT` to `["/run.sh"]` to completely override S6 initialization.

## 1.0.11

- Switched Base Image to standard `ghcr.io/home-assistant/amd64-base:alpine` to
  resolve S6 overlay conflicts.
- This aligns the execution environment with other working addons (like Solumati).

## 1.0.10

- Added `ENTRYPOINT []` to Dockerfile to guarantee S6 overlay is disabled.

## 1.0.9

- Refactored startup to use direct `CMD` execution instead of S6 services to
  definitively resolve PID 1 errors.
- **Note**: This requires a manual `git push` to take effect.

## 1.0.8

- Added debug logging to verify execution of new script version.

## 1.0.7

- Re-release to ensure manual environment loading fix is propagated.

## 1.0.6

- Implemented manual environment loading to fix PID 1 error while maintaining
  Supervisor API access.

## 1.0.5

- Removed `with-contenv` from shebang to permanently resolve the
  "s6-overlay-suexec: fatal: can only run as pid 1" error.

## 1.0.4

- Refactored startup to use S6 legacy services (services.d) properly,
  fixing PID 1 error.

## 1.0.3

- Fixed s6-overlay-suexec "can only run as pid 1" error by adding `init: false`

## 1.0.1 & 1.0.2

- **Fix**: Critical startup fix. Refactored Container structure (CMD vs S6
  services.d) to resolve s6 loop error.

## 1.0.0

- Initial release
