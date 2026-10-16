# Changelog

## 0.1.6 (2026-10-16)

### 🐛 Bug Fixes

- Fix "Invalid Host header" error under Home Assistant Ingress and external reverse proxies
- Export `PASEO_HOSTNAMES="true"` and `PASEO_ALLOWED_HOSTS="true"` in daemon environment
- Patch `hostnames.js` and `bootstrap.js` in Paseo server to bypass DNS rebinding check in Ingress
- Forward `Host 127.0.0.1:6767` with `X-Forwarded-Host` preservation in Ingress Nginx proxy

## 0.1.5 (2026-10-16)

- Release version 0.1.5

## 0.1.4 (2026-10-16)

- Release version 0.1.4

## 0.1.3 (2026-10-16)

- Align OmniRoute cascades, remote MCP servers (playwright, mcphub, openwiki, dell-paseo), and code.fabiseitz.de central Web UI

## 0.1.2 (2026-10-16)

### ✨ Features

- Add Paseo AI Code Studio add-on with native Ingress, OmniRoute integration, and developer recommendations

### 🐛 Bug Fixes

- Fix daemon runtime command to `paseo daemon run` with persistent home directory `/root/.paseo`
- Pre-configure `features.webUi.enabled: true` and listener for Home Assistant Ingress rendering
- Add `@kilocode/cli` and `openwiki` globally to mirror Oracle Cloud developer tooling
