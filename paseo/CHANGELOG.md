# Changelog

## 0.3.1 (2026-11-21)

### ✨ Features
- move to stable root, bump to 0.1.9, fix ingress route ([`011d85f1`](https://github.com/FaserF/hassio-addons/commit/011d85f1c36cbf299d180bc3e120ba368abb8e38))

### 🐛 Bug Fixes
- enforce patched nginx for CVE-2026-123007 across 10 addons ([`2aa47a45`](https://github.com/FaserF/hassio-addons/commit/2aa47a4566f54f2634f53dd87bfa1f46cf707e7c))

### 📌 Release Note
- Security: enforce patched nginx (>=1.28.3-r8 / >=1.30.7-r0 / >=1.26.3-3+deb13u11) against CVE-2026-123007


## 0.3.0 (2026-11-18)

### ✨ Features

- move to stable root, bump to 0.1.9, fix ingress route ([`011d85f1`](https://github.com/FaserF/hassio-addons/commit/011d85f1c36cbf299d180bc3e120ba368abb8e38))

## 0.1.9 (2026-11-18)

- Moved addon from `.dev/` to stable root channel.
- Fix SSRF vulnerability in `/send_image` route.

## 0.1.7 (2026-10-16)

- reconcile serverId mismatch, auto-seed last workspace, and fix websocket upgrade

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
