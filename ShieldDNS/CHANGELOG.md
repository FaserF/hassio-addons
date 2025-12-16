## 1.3.3

- **Fix**: Critical startup fix. Refactored Container structure (CMD vs S6 services.d) to resolve s6 loop error.

## 1.3.1

- **Refinement**: Made `dot_port` and `doh_port` optional. You can now run DoT-only or DoH-only.
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
