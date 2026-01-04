# Changelog

## 2.0.1-dev-4df2838 (2026-01-04)

### 🐛 Bug Fixes
- rename README.MD to README.md and prevent run.sh startup crashes ([`4fc77546`](https://github.com/FaserF/hassio-addons/commit/4fc775469d5aec6dd85ac55e71ffff56388b7228))
- resolve multiple values for token_file_path and fix retry interval typo ([`53128e76`](https://github.com/FaserF/hassio-addons/commit/53128e76166ccb609ca5558a933244de37c5cfbc))

### 📦 Dependencies
- 📝 release(tado_aa): update changelog [skip-tests] ([`1601e958`](https://github.com/FaserF/hassio-addons/commit/1601e958695184423d7bbf85db62a0f6b0446cfe))
- 📝 release(tado_aa): update changelog [skip-tests] ([`04fe4a40`](https://github.com/FaserF/hassio-addons/commit/04fe4a404dd3ba7728e9a80850bd64b1f7675df9))
- Bump all addon versions ([`7a5426ba`](https://github.com/FaserF/hassio-addons/commit/7a5426bac78e1dbbbf0de477757cbe4562594434))

### 📝 Documentation
- improved READMEs ([`083b3025`](https://github.com/FaserF/hassio-addons/commit/083b30254f65656f616671ec8aa6649cbe085b8e))

### 🚀 Other
- New Addon: Wordpress (#539) [skip-tests] ([`4df28386`](https://github.com/FaserF/hassio-addons/commit/4df2838673a3b689f6feda37a8232a2665a410b7))
- ci fixes ([`cf220dc5`](https://github.com/FaserF/hassio-addons/commit/cf220dc5ea8a883cef79c8b09901bd366c5878e3))
- fix ci ([`372c4c2c`](https://github.com/FaserF/hassio-addons/commit/372c4c2c8221b70515414846fe578261f63a23ac))
- small fix ([`4de506d9`](https://github.com/FaserF/hassio-addons/commit/4de506d97842d06151ae7fbb437d62669a70eb48))
- Small fix [skip-ci] ([`5d5dafdb`](https://github.com/FaserF/hassio-addons/commit/5d5dafdb9fbd76b182107a1cf0085c2d49d3ca15))
- more CI fixes about version pinning ([`7c611f51`](https://github.com/FaserF/hassio-addons/commit/7c611f519f4b080e59068053c92a4c0d5e6a6f5b))
- more CI fixes ([`e6e6a6ae`](https://github.com/FaserF/hassio-addons/commit/e6e6a6ae0f66f70f3b1940233b27df356d3a9ea2))
- small fixes ([`aa24d6e1`](https://github.com/FaserF/hassio-addons/commit/aa24d6e11af9ce4c631505f4dfa490330a48598c))
- Watchdog fixes ([`defec20c`](https://github.com/FaserF/hassio-addons/commit/defec20cc30e2499935f8946abd6d0dd8a4928e0))
- Docs improvements ([`9ba3343c`](https://github.com/FaserF/hassio-addons/commit/9ba3343c174fc850b55a9d73117eb57476b9d5cb))
- small addon fixes ([`f3f3e0f5`](https://github.com/FaserF/hassio-addons/commit/f3f3e0f56b1c3fb6e8a44e396592b6177dd9c769))
- fix Addon startup ([`7a83fd1c`](https://github.com/FaserF/hassio-addons/commit/7a83fd1cf7e004cd117e2372f51880fde076f4dc))
- fixed addon startup issues ([`29ed9ca8`](https://github.com/FaserF/hassio-addons/commit/29ed9ca8cc9312be4fe346d2674cb333c0a59859))
- fix banner printing ([`de18e9e2`](https://github.com/FaserF/hassio-addons/commit/de18e9e2fec69ebd2a73139670d5bc6f858b8e75))


## 2.0.0 (2026-01-03)

🎉 **Happy New Year 2026!** 🎉

### 🎉 Major Release - Unified Addon Update

All addons have been unified, updated, and many bugs have been fixed. Many addons have been partially or completely rewritten to improve stability, performance, and maintainability.

#### Important Information

- **Edge Branch (Beta)**: A new `edge` branch is now available for those who want to test the latest features and improvements before they are released to the stable channel.
- **Unsupported Branch**: A new `unsupported` branch has been created for addons that no longer receive direct manual support. These addons are still maintained but may have limited support compared to the main addons.
- **Bug Reports**: If you encounter any new issues, please report them on GitHub as usual. Your feedback helps us improve the addons.

This release represents a significant effort to standardize and improve all addons in the repository.

---

### 📦 Dependencies

- 📝 release(apache2-minimal): update changelog [skip-tests] ([`476e2f5`](https://github.com/FaserF/hassio-addons/commit/476e2f5ff7c65d67eb19d251f2d3fa778cc15f2f))

### 🎉 Major Release - Unified Addon Update (Continued)

- **Bug Reports**: If you encounter any new issues, please report them on GitHub as usual. Your feedback helps us improve the addons. (Manual)
- **Unsupported Branch**: A new `unsupported` branch has been created for addons that no longer receive direct manual support. These addons are still maintained but may have limited support compared to the main addons. (Manual)
- **Edge Branch (Beta)**: A new `edge` branch is now available for those who want to test the latest features and improvements before they are released to the stable channel. (Manual)

### 📌 Release Note

- Manual release via Orchestrator## 1.7.2 (2026-01-03)

- Bump version to 1.7.2

## 1.7.1

- Automatically updated addon-base to version v19.0.0

## 1.7.0

- Automatically updated addon-base to version v19.0.0
- Drop support for armhf, armv7, and i386 systems

## 1.6.10

- Test

## 1.6.9

- Automatically updated addon-base to version v18.2.1

## 1.6.8

- fix unable to exec bashio

## 1.6.7

- Bump python-tado to v0.19.2

## 1.6.6

- Fixed an error while updating / installing the latest version
  - This happened due to a faulty image building process
  - Since this issue has been in the last few updates, I have stopped the
    automatic update and release workflow for now

## 1.6.5

- Automatically updated addon-base to version v17.2.5

## 1.6.4

- Automatically updated addon-base to version v17.2.2

## 1.6.3

- Automatically updated addon-base to version v17.2.1

## 1.6.2

- Automatically updated addon-base to version v17.2.1

## 1.6.1

- enabled the usage of own GitHub images

## 1.6.0

- Prepared using own GitHub image for backups & addon building
  -> This lowers the backup sizes for this addon
  -> Not yet activated, only everything has been prepared

## 1.5.6

- Automatically updated addon-base to version v17.2.1

## 1.5.5

- automatically update addon-base to version v17.0.1

## 1.5.4

- automatically update addon-base to version v17.0.0

## 1.5.3

- automatically update addon-base to version v16.3.6

## 1.5.2

- automatically update addon-base to version v16.3.5

## 1.5.1

- automatically update addon-base to version v16.3.4

## 1.5.0

- automatically update addon-base to version v16.3.3

## 1.4.9

- automatically update addon-base to version v16.3.2

## 1.4.8

- automatically update addon-base to version v16.3.1

## 1.4.7

- automatically update addon-base to version v16.3.0

## 1.4.6

- automatically update addon-base to version v16.2.1

## 1.4.5

- automatically update addon-base to version v16.1.3

## 1.4.3

- display more terminal output by default
- new log_level option

## 1.4.2

- automatically update addon-base to version v16.0.0

## 1.4.1

- bump hassio-addon-base to version v15.0.8

## 1.4.0

- update hassio-addon-base to version v15.0.4
- bump python-tado to version 0.17.3
- Switch python to venv to allow pip moduls on newer addon base version

## 1.3.9

- fix min & maxtemp options in GUI and config file
- this fixes that new users could not see the addon
- automatically update hassio-addon-base to version v14.3.2

## 1.3.8

- Fix: Do not allow unsupported min/max temp values
- update tado_aa python module to the latest version

## 1.3.7

- automatically update hassio-addon-base to version v14.3.1

## 1.3.6

- automatically update hassio-addon-base to version v14.2.2

## 1.3.5

- automatically update hassio-addon-base to version v14.1.3

## 1.3.4

- automatically update hassio-addon-base to version v14.0.8

## 1.3.3

- automatically update hassio-addon-base to version v14.0.8

## 1.3.2

- automatically update hassio-addon-base to the latest version

## 1.3.1

- automatically update hassio-addon-base to the latest version

## 1.3.0

- bump hassio-addon-base to V14.0.0
- autorelease new version updates on addon base updates
- auto bump dependency updates for tado-aa python module

## 1.2.0

- bump hassio-addon-base to the latest version
- update tado-aa python module
- new feature: define min temp
- new feature: define max temp

## 1.1.0

- Bump Addon Base to V10.0.0

## 1.0.1

- Implement new username password detection from base python source

## 1.0.0

- Initial release
