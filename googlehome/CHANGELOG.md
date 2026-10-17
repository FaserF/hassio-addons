# Changelog

## 0.1.2

- Add live progress stepper and loading indicator for Google Find My E2EE Shared Key extraction
- Add `/api/findmy/extract-status` endpoint for polling extraction stages
- Detect and report Google password / screen-lock security challenge during auto-extraction
- Fix token parameter passing during automated background extraction callback

## 0.1.1

- Fix Find My E2EE key auto-extraction: sign headless browser in via master token (works without prior Google Home browser login)
- Register unlock-page JS bridge before page load so the vault key callback is no longer missed
- Add diagnostic warnings when extraction fails

## 0.1.0

- Initial release of Google Home Token Hub Add-on.
