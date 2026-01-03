# Changelog

## 0.3.0 (2026-01-03)

🎉 **Happy New Year 2026!** 🎉

### 🎉 Major Release - Unified Addon Update

All addons have been unified, updated, and many bugs have been fixed. Many addons have been partially or completely rewritten to improve stability, performance, and maintainability.

#### Important Information

- **Edge Branch (Beta)**: A new `edge` branch is now available for those who want to test the latest features and improvements before they are released to the stable channel.
- **Unsupported Branch**: A new `unsupported` branch has been created for addons that no longer receive direct manual support. These addons are still maintained but may have limited support compared to the main addons.
- **Bug Reports**: If you encounter any new issues, please report them on GitHub as usual. Your feedback helps us improve the addons.

This release represents a significant effort to standardize and improve all addons in the repository.

---

## 0.2.0

- 🛠️ **Fix**: Ingress Dashboard now works correctly (trailing slash URL fix)
- 🛠️ **Fix**: Browser fingerprint consistency (macOS/Chrome)
- ⬆️ **Upgrade**: Baileys to 6.7.21 (latest v6)
- ✨ **New**: Debug logging in browser console for Ingress fetch calls

## 0.1.0

- ✨ **New**: Secured API with Token Authentication (Ingress & Integration)
- ✨ **New**: Ingress Dashboard with Status, API Token and Live QR Code
- ✨ **New**: Smart Discovery (Auto-detects Addon Hostname)
- ✨ **New**: Reset Session option in Integration
- 🛠️ **Fix**: Ingress Compatibility (Wildcard Routing, Relative Paths)
- 🛠️ **Fix**: Build & Startup Issues (Node 24, S6 Overlay)

## 0.0.2

- Upgrade to Node.js 24 (Alpine Edge)
- Convert backend to ESM (ES Modules)
- Full S6 Service Supervision (Platinum Standard)
- Change default port to 8066
- Fix Translation Errors
- Add Icons

## 0.0.1

- Initial Release (Baileys Backend)
