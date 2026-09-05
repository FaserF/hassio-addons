# Changelog

## 0.1.1-dev-20260905-2205-2e80491 (2026-09-05)

### ✨ Features
- move in-development add-ons to .dev/ directory to hide from stable repository in Home Assistant ([`2e804917`](https://github.com/FaserF/hassio-addons/commit/2e8049174658ea37ac75009502669b59c49f2404))
- add shellcheck shell=bash directive to s6 run scripts ([`21ee2b7f`](https://github.com/FaserF/hassio-addons/commit/21ee2b7f06b3d42098c1c15ff507324b0d71190a))
- add interactive web sign-in and remove hardcoded credentials ([`ec6caba8`](https://github.com/FaserF/hassio-addons/commit/ec6caba82ccbd3c8b6a1529a81a145563c691c44))
- add interactive 1-click Google OAuth device login and remove demo mode ([`8598baac`](https://github.com/FaserF/hassio-addons/commit/8598baac1c5255951d401e3ceb9ba8bc7b134973))

### 🐛 Bug Fixes
- restrict phone/pin input types, improve restart notification ([`dd594a6c`](https://github.com/FaserF/hassio-addons/commit/dd594a6cbbdc5a93df23c1cafa67a7be261dc7f5))
- fix s6-rc oneshot structure and uvicorn log level mapping ([`8af58638`](https://github.com/FaserF/hassio-addons/commit/8af586380370ea4ea7a48a5ca90a419e19d1d126))
- use with-contenv bashio shebang in s6-rc service scripts ([`86d66303`](https://github.com/FaserF/hassio-addons/commit/86d6630363c80cd0930f078eb6d25e72ecbb6c02))
- regenerate accurate changelogs for all addons and fix release commit matching in bump_version.py ([`b667eef9`](https://github.com/FaserF/hassio-addons/commit/b667eef9f23c882efd02c11535c2ea4c9bbad5f5))

### 📦 Dependencies
- update project manifests and format files ([`7d601d44`](https://github.com/FaserF/hassio-addons/commit/7d601d447c535d79e3f3f944726a5f11fe424d58))

### 📝 Documentation
- ci: integrate in-development add-ons blacklist across workflows, scripts and README generators ([`6f5b41cc`](https://github.com/FaserF/hassio-addons/commit/6f5b41cc98d3fc3592543b75ad72bd7a4f331825))

### 🚀 Other
- Standardize log_level configuration and handling across all add-ons ([`7ddda206`](https://github.com/FaserF/hassio-addons/commit/7ddda206529ef9453a58d36af03969ed975a8e66))
- small fix ([`5c053a55`](https://github.com/FaserF/hassio-addons/commit/5c053a55cfb9ba977c4c7660233be0a506b38b57))


## 0.1.0 (2026-08-23)

### 📦 Dependencies

- ⬆️ Update Add-on base images ([`cff61763`](https://github.com/FaserF/hassio-addons/commit/cff61763699487bc020cab1735cafd22ebd6f0cf))
