# Changelog
## 1.3.15

- **Improvement**: Implemented intentional "Smart Fallback" for DoT Port. Default is
  now `853` (Standard), but if blocked (e.g. by AdGuard), it automatically switches
  to `8853`. This fixes CI/CD tests while maintaining ease of use.

## 1.3.14

- **Fix**: Resolved "unbound variable" startup crash by correcting variable
  initialization order in `run.sh`.
- **Change**: Changed default `dot_port` to `8853` to prevent boot loops if AdGuard
  Home (port 853) is active.
- **Improvement**: Added robust pre-flight port checks using `netstat`. Conflicts now
  pause startup and show the conflicting process name instead of crashing.
- **Cleanup**: Removed unused "Alternative DoH Ports" (784, 2443) to simplify
  configuration.

## 1.3.13

- Fixed Nginx exiting immediately (daemon mode) by forcing `daemon off;`, resolving
  the restart loop.

## 1.3.12

- Fixed CoreDNS startup crash by explicitly clearing `Corefile` before generation
  (preventing duplicate config entries).

## 1.3.11

- Fixed CoreDNS crash caused by "null" string in port configuration.
- Updated Nginx SSL config to remove deprecated `http2` directive.

## 1.3.10

- Re-release to ensure all previous fixes (unbound variables, shebangs) are propagated.

## 1.3.9

- Reverted shebang to `with-contenv` to restore Supervisor API access
  (fixing "Forbidden" error).

## 1.3.8

- Fixed "unbound variable" crash when optional features are disabled.
- Removed `with-contenv` from shebang to prevent S6 context conflicts.

## 1.3.7

- Fixed startup error "unable to exec bashio" by correcting shebang to `with-contenv`

## 1.3.6

- Fixed s6-overlay-suexec "can only run as pid 1" error by adding `init: false`

## 1.3.3 & 1.3.4 & 1.3.5

- **Fix**: Critical startup fix. Refactored Container structure (CMD vs S6
  services.d) to resolve s6 loop error.

## 1.3.1

- **Refinement**: Made `dot_port` and `doh_port` optional. You can now run DoT-only
  or DoH-only.
- **Fix**: Startup script now verifies at least one port is active.
- **New**: Added functional Status Indicator to the Info Page (checks /dns-query).
- **Fix**: Fixed S6 startup error by restoring correct shebang.

## 1.3.0

- **Feature**: Optional "Single Port" Info Page (Serve Web + DoH on same port).
- **Config**: Added `enable_info_page` option.

## 1.2.0

- **Feature**: Host Network Mode (`host_network: true`) for Source IP visibility.
- **Refinement**: Made alternative DoH ports optional (removed from default config).
- **Change**: Changed default DoT port to `8853` to avoid AdGuard Home conflict.

## 1.1.0

- **Feature**: Added DoH (DNS-over-HTTPS) support.
- **New**: Added ShieldDNS Logo.
- **Docs**: Cloudflare Tunnel integration guide.
