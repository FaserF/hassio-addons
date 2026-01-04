# Changelog

## 2.0.1-dev-4fc7754 (2026-01-04)

### 🐛 Bug Fixes
- rename README.MD to README.md and prevent run.sh startup crashes ([`4fc77546`](https://github.com/FaserF/hassio-addons/commit/4fc775469d5aec6dd85ac55e71ffff56388b7228))
- ensure docker image tags are lowercase to comply with registry standards ([`bfc1a33a`](https://github.com/FaserF/hassio-addons/commit/bfc1a33a0fec75c71b810b45e624817b4b6cc5b9))

### 📦 Dependencies
- 📝 release(ShieldFile): update changelog [skip-tests] ([`ed38a822`](https://github.com/FaserF/hassio-addons/commit/ed38a822a1ef069600acf1c87bc3d071dde52fcc))
- 📝 release(ShieldFile): update changelog [skip-tests] ([`9fbe018e`](https://github.com/FaserF/hassio-addons/commit/9fbe018ef9bb99d6833e72821f4de1710af5f3b6))
- 📝 release(ShieldFile): update changelog [skip-tests] ([`d070e612`](https://github.com/FaserF/hassio-addons/commit/d070e6127b574d1094c0d8cea003fa847fb54c32))
- 📝 release(ShieldFile): update changelog [skip-tests] ([`7de3ae1c`](https://github.com/FaserF/hassio-addons/commit/7de3ae1c4bcfae3b95d512edd3ffbf10b2810e51))
- 📝 release(ShieldFile): update changelog [skip-tests] ([`c31c91de`](https://github.com/FaserF/hassio-addons/commit/c31c91ded539dd44be164d3e3d7f072556f96936))
- Bump all addon versions ([`7a5426ba`](https://github.com/FaserF/hassio-addons/commit/7a5426bac78e1dbbbf0de477757cbe4562594434))

### 🔧 Configuration
- revert master branch to stable versions (removed -dev suffixes) ([`4f35d8ad`](https://github.com/FaserF/hassio-addons/commit/4f35d8ad59ba6f04a4360ace09024eb7bbb459cd))

### 📝 Documentation
- improved READMEs ([`083b3025`](https://github.com/FaserF/hassio-addons/commit/083b30254f65656f616671ec8aa6649cbe085b8e))

### 🎨 Style
- auto-fix (prettier,markdownlint) ([`073bc2d2`](https://github.com/FaserF/hassio-addons/commit/073bc2d241297edab9de99d8f4a4e194d0235297))

### 🚀 Other
- small fix ([`4de506d9`](https://github.com/FaserF/hassio-addons/commit/4de506d97842d06151ae7fbb437d62669a70eb48))
- CI fix trailing space & small changes ([`1810d07e`](https://github.com/FaserF/hassio-addons/commit/1810d07ef767660ddeef92615f9d95da025e83d9))
- more CI fixes ([`032a62cd`](https://github.com/FaserF/hassio-addons/commit/032a62cdaa45ecd61b19ea51897230c4179f3e9f))
- Docs improvements ([`9ba3343c`](https://github.com/FaserF/hassio-addons/commit/9ba3343c174fc850b55a9d73117eb57476b9d5cb))
- small addon fixes ([`f3f3e0f5`](https://github.com/FaserF/hassio-addons/commit/f3f3e0f56b1c3fb6e8a44e396592b6177dd9c769))
- fix Addon startup ([`7a83fd1c`](https://github.com/FaserF/hassio-addons/commit/7a83fd1cf7e004cd117e2372f51880fde076f4dc))
- fixed addon startup issues ([`29ed9ca8`](https://github.com/FaserF/hassio-addons/commit/29ed9ca8cc9312be4fe346d2674cb333c0a59859))
- fix banner printing ([`de18e9e2`](https://github.com/FaserF/hassio-addons/commit/de18e9e2fec69ebd2a73139670d5bc6f858b8e75))
- Fixes for Addon start issues ([`c34d7b58`](https://github.com/FaserF/hassio-addons/commit/c34d7b585d4d6f377d7d44803833e0d612b59120))


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
