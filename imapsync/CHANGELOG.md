# Changelog

## 0.4.2 (2026-08-19)

### ✨ Features
- add Google Antigravity Usage monitor addon ([`81495c89`](https://github.com/FaserF/hassio-addons/commit/81495c890a4d15605f44d0ac5c30ff2b85db4dd0))
- configure specific startup phases and integration discovery for relevant addons ([`2f939fbd`](https://github.com/FaserF/hassio-addons/commit/2f939fbd8771f1d02798081dff4759e5c67fcc88))
- add restart loop protection to startup banners and fix gt import error ([`da300834`](https://github.com/FaserF/hassio-addons/commit/da3008348fc12ea389004b10665cbae4d7a8e112))

### 🐛 Bug Fixes
- convert pseudo-PNG jpeg images to genuine PNG format and improve autofix ([`9803f56c`](https://github.com/FaserF/hassio-addons/commit/9803f56c2606138cf0e41de1c02368cf2b32566c))
- replace deprecated bashio::addon.stop with bashio::app.stop and harmonize APP_VERSION variables ([`e74d22d6`](https://github.com/FaserF/hassio-addons/commit/e74d22d66be715d3ea2efad6e4919b70bf4a81ce))
- harden parameter expansion in startup banner for set -u strict mode ([`cb8ad15b`](https://github.com/FaserF/hassio-addons/commit/cb8ad15bd5df93dd1da6081ac20ab2332f4d3b29))
- use safe expansion \ for set -u compatibility ([`560bc0fc`](https://github.com/FaserF/hassio-addons/commit/560bc0fce19cd258f025a328ffd5f6addd78f688))

### 📦 Dependencies
- ⬆️ Update Add-on base images ([`cff61763`](https://github.com/FaserF/hassio-addons/commit/cff61763699487bc020cab1735cafd22ebd6f0cf))
- update icons and convert logos to official landscape banners ([`e6d061bd`](https://github.com/FaserF/hassio-addons/commit/e6d061bd8292ae6ca473fa21a2e55d5e5f4e70ea))


## 0.4.1 (2026-07-31)

### 🐛 Bug Fixes

- CI hadolint linter fixes ([`44ea2cc0`](https://github.com/FaserF/hassio-addons/commit/44ea2cc0151b77d64b24e83eacfe2fff00be618d))

### 📦 Dependencies

- ⬆️ Update ghcr.io/hassio-addons/base Docker tag to v[21.0.1](https://github.com/hassio-addons/addon-base/releases/tag/21.0.1) [skip-tests] ([`094ebba0`](https://github.com/FaserF/hassio-addons/commit/094ebba0fdc857838145fd802b3f0fc04af829a1))
- ⬆️ Update dependency imapsync/imapsync to v2.314 (#907) [skip-tests] ([`ef7670b7`](https://github.com/FaserF/hassio-addons/commit/ef7670b7a5a2ff3ed75b12af678862c458221349))

## 0.4.0 (2026-06-16)

### 📦 Dependencies

- ⬆️ Update Add-on base images to v21 [skip-tests] ([`2efc4ca0`](https://github.com/FaserF/hassio-addons/commit/2efc4ca058bca977cf5667d3778a6232d45b3ab2))
- ⬆️ Update ghcr.io/hassio-addons/base Docker tag to v[20.1.1](https://github.com/hassio-addons/addon-base/releases/tag/20.1.1) [skip-tests] ([`c798075a`](https://github.com/FaserF/hassio-addons/commit/c798075ac062595a2e1a91754ab9768b47f20c46))
- ⬆️ Update ghcr.io/hassio-addons/base Docker tag to v[20.1.0](https://github.com/hassio-addons/addon-base/releases/tag/20.1.0) [skip-tests] ([`709f7882`](https://github.com/FaserF/hassio-addons/commit/709f7882b67adc67ab6f64370f1d900e9a71b2e1))
- fix docker build for musl dependency ([`5c5d45ee`](https://github.com/FaserF/hassio-addons/commit/5c5d45eee91ef4223b5feae85b87011977406dd5))
- ⬆️ Update ghcr.io/hassio-addons/base Docker tag to v[20.0.3](https://github.com/hassio-addons/addon-base/releases/tag/20.0.3) [skip-tests] ([`d765bff1`](https://github.com/FaserF/hassio-addons/commit/d765bff148faae0ef9dfe1a7a4634b4fdc598592))

### 🚀 Other

- fix docker build ([`db25a412`](https://github.com/FaserF/hassio-addons/commit/db25a4124eab24641d43807fc7b97df694d6e758))
- fix docker build in newer alpine version ([`86bfc25f`](https://github.com/FaserF/hassio-addons/commit/86bfc25fa7528eba34bf57b1eb9a40fb62dba0a5))

## 0.3.1 (2026-04-09)

### 🚀 Other

- fix HA list usage ([`e4636cd1`](https://github.com/FaserF/hassio-addons/commit/e4636cd1b2a8e60b1a3c23523b8d08a1a22c24b2))

## 0.3.0

- [x] **imapsync v0.3.0**: Major milestone release consolidating all stability and logging improvements.
- Robust real-time logging: switched to a sub-second Perl log poller for zero-lag activity updates.

## 0.2.8

- Broadened real-time log monitoring to include individual message transfer status (`- msg`, `+ msg`, `copied`). This ensures continuous, definitive proof of activity during massive folder syncs where `imapsync` natively suppresses high-level folder progress markers in non-interactive environments.

## 0.2.7

- Fixed silent sync operations by enforcing the `--debugfolders` flag natively on all runs. `imapsync` normally suppresses folder progress markers when not attached to a terminal, leading to perceived hangs; this guarantees continuous progress logs are generated so the add-on can capture and display them reliably.

## 0.2.6

- Replaced `stdbuf` with `unbuffer` (from `expect` package) for native Alpine compatibility, preventing the `command not found` (127) crash.
- Added automatic tailing of the last 25 raw log lines into the Home Assistant Add-on log whenever `imapsync` encounters a fatal error, making debugging immediate and transparent.

## 0.2.5

- Added missing `coreutils` package to Docker build to support `stdbuf` line buffering, fixing a crash and double-logging loop caused by command not found errors.

## 0.2.4

- Fixed Perl stdout block-buffering issue via `stdbuf`, forcing real-time output even when redirected to a log file.

## 0.2.3

- Replaced Bash regex line-filtering with pure substring matching to ensure consistent real-time logging across Alpine environments.

## 0.2.2

- Changed `included_folders` to use `--folder` instead of `--include` for robust explicit folder matching
- Fixed grep line-buffering error resulting in a pipe broken exit code (141)

## 0.2.1

- Fixed Imapsync hanging on empty or large mailboxes due to interactive timeout bugs
- Rebuilt log parser to display precise folder sizes and progress in real-time
- Fixed OAuth2 password prompt fallback error

## 0.2.0

- Added advanced synchronization options (folder filtering, age/size limits, etc.)
- Improved logging with real-time feedback and heartbeat status
- Simplified sync loop for better stability
- Expanded translations for all new features

## 0.1.0

- Initial release of the Imapsync Add-on
