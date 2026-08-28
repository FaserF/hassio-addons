# Changelog

## 0.4.3 (2026-08-28)

### ✨ Features
- move in-development add-ons to .dev/ directory to hide from stable repository in Home Assistant ([`2e804917`](https://github.com/FaserF/hassio-addons/commit/2e8049174658ea37ac75009502669b59c49f2404))

### 🐛 Bug Fixes
- migrate user bundles from s6-rc.d to user-bundles.d to fix deprecation warning ([`73156ded`](https://github.com/FaserF/hassio-addons/commit/73156ded6152ca7cab2e34950ec95461dd4fb4dd))
- eliminate duplicate alert blocks and standardize README notice cleaning ([`fdf7b787`](https://github.com/FaserF/hassio-addons/commit/fdf7b787f1450d3e372795a968a68b6b721181a4))
- regenerate accurate changelogs for all addons and fix release commit matching in bump_version.py ([`b667eef9`](https://github.com/FaserF/hassio-addons/commit/b667eef9f23c882efd02c11535c2ea4c9bbad5f5))

### 📦 Dependencies
- ⬆️ Update ghcr.io/hassio-addons/base Docker tag to v[21.0.3](https://github.com/hassio-addons/addon-base/releases/tag/21.0.3) ([`00265df2`](https://github.com/FaserF/hassio-addons/commit/00265df231b32c916e0470852ef907b2d942b8d4))

### 🔧 Configuration
- deactivate dev sync workflow, delete local dev branch, and point in-dev notices exclusively to Edge channel ([`eb3f45de`](https://github.com/FaserF/hassio-addons/commit/eb3f45de16d3e72806094cff745bd3a727ae3ef8))

### 📝 Documentation
- ci: integrate in-development add-ons blacklist across workflows, scripts and README generators ([`6f5b41cc`](https://github.com/FaserF/hassio-addons/commit/6f5b41cc98d3fc3592543b75ad72bd7a4f331825))

### 🚀 Other
- Standardize log_level configuration and handling across all add-ons ([`7ddda206`](https://github.com/FaserF/hassio-addons/commit/7ddda206529ef9453a58d36af03969ed975a8e66))


## 0.4.2 (2026-08-19)

### ✨ Features

- add Google Antigravity Usage monitor addon ([`81495c890`](https://github.com/FaserF/hassio-addons/commit/81495c890a4d15605f44d0ac5c30ff2b85db4dd0))
- configure specific startup phases and integration discovery for relevant addons ([`2f939fbd8`](https://github.com/FaserF/hassio-addons/commit/2f939fbd8771f1d02798081dff4759e5c67fcc88))

### 🐛 Bug Fixes

- convert pseudo-PNG jpeg images to genuine PNG format and improve autofix ([`9803f56c2`](https://github.com/FaserF/hassio-addons/commit/9803f56c2606138cf0e41de1c02368cf2b32566c))
- replace deprecated bashio::addon.stop with bashio::app.stop and harmonize APP_VERSION variables ([`e74d22d66`](https://github.com/FaserF/hassio-addons/commit/e74d22d66be715d3ea2efad6e4919b70bf4a81ce))
- harden parameter expansion in startup banner for set -u strict mode ([`cb8ad15bd`](https://github.com/FaserF/hassio-addons/commit/cb8ad15bd5df93dd1da6081ac20ab2332f4d3b29))
- use safe expansion \ for set -u compatibility ([`560bc0fce`](https://github.com/FaserF/hassio-addons/commit/560bc0fce19cd258f025a328ffd5f6addd78f688))
- add restart loop protection to startup banners and fix gt import error ([`da3008348`](https://github.com/FaserF/hassio-addons/commit/da3008348fc12ea389004b10665cbae4d7a8e112))

### 📦 Dependencies

- ⬆️ Update Add-on base images ([`cff617636`](https://github.com/FaserF/hassio-addons/commit/cff61763699487bc020cab1735cafd22ebd6f0cf))
- update icons and convert logos to official landscape banners ([`e6d061bd8`](https://github.com/FaserF/hassio-addons/commit/e6d061bd8292ae6ca473fa21a2e55d5e5f4e70ea))

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
