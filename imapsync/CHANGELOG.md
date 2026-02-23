# Changelog

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
