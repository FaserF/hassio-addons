# FaserF's Home Assistant Add-ons 🏠

This repository contains a collection of custom **Home Assistant Add-ons**
maintained by FaserF.

> [!NOTE]
> These add-ons are primarily intended for my own private use. I strive to fix bugs or implement feature requests, but I cannot guarantee it. Add-ons that I no longer use myself receive poorer support from me.

[![View in Code Wiki](https://img.shields.io/badge/View_in-Code_Wiki-8A2BE2?style=flat-square&logo=google&logoColor=white)](https://codewiki.google/github.com/FaserF/hassio-addons)

## Installation 🚀

### 📦 Stable Channel (Recommended)

Pre-built Docker images from official releases. Best for most users.

1. Click to add the stable repository:
   [![Add Stable Repository](https://my.home-assistant.io/badges/supervisor_add_addon_repository.svg)](https://my.home-assistant.io/redirect/supervisor_add_addon_repository/?repository_url=https%3A%2F%2Fgithub.com%2FFaserF%2Fhassio-addons)

2. Or manually add:
   ```text
   https://github.com/FaserF/hassio-addons
   ```

### 🚧 Edge Channel (Development)

Latest development builds - built locally from your device. For testing new features.

1. Click to add the edge repository:
   [![Add Edge Repository](https://my.home-assistant.io/badges/supervisor_add_addon_repository.svg)](https://my.home-assistant.io/redirect/supervisor_add_addon_repository/?repository_url=https%3A%2F%2Fgithub.com%2FFaserF%2Fhassio-addons%23edge)

2. Or manually add:
   ```text
   https://github.com/FaserF/hassio-addons#edge
   ```

> [!WARNING]
> **Edge builds are built locally on your device** from the Dockerfile source code.
> This takes longer and uses more resources than pre-built images.
> Edge versions may contain bugs or incomplete features.

| Channel | Pre-built Images | Update Speed | Stability |
|---------|------------------|--------------|-----------|
| **Stable** | ✅ Yes | Fast | 🟢 High |
| **Edge** | ❌ No (local build) | Slow | 🟡 Medium |

## Add-ons List 📦

The table below shows **all add-ons** in this repository, including unsupported ones.

<!-- markdownlint-disable MD060 -->

| Name                                                            | Description                               | Status | Added |
| :-------------------------------------------------------------- | :---------------------------------------- | :----- | :---- |
| **[AegisBot](AegisBot)**                                        | Telegram Bot Management Server            | ✅     | 2026-01 |
| **[Antigravity Server](antigravity-server)**                    | Antigravity AI IDE via NoVNC              | ⚠️     | 2026-01 |
| **[Apache2](apache2)**                                          | Webserver with PHP and MariaDB            | ✅     | 2023-03 |
| **[Apache2 Minimal](apache2-minimal)**                          | Webserver (Minimal, no PHP)               | ✅     | 2023-03 |
| **[Apache2 Minimal + MariaDB](apache2-minimal-mariadb)**        | Webserver with MariaDB and PHP            | ✅     | 2023-03 |
| **[Bash Script Executer](bash_script_executer)**                | Execute bash scripts in HA OS             | ✅     | 2023-05 |
| **[BT MQTT Gateway](.unsupported/bt-mqtt-gateway)**             | Bluetooth MQTT Gateway (Unsupported)      | ❌     | 2023-05 |
| **[Freenom DNS Updater](.unsupported/freenom-dns-updater)**     | Dynamic DNS Updater (Unsupported)         | ❌     | 2023-05 |
| **[Home Assistant Test Instance](homeassistant-test-instance)** | Nested Home Assistant for Testing         | ⚠️     | 2026-01 |
| **[Matterbridge](matterbridge)**                                | Simple chat bridge                        | ✅     | 2023-05 |
| **[Netboot.xyz](netboot-xyz)**                                  | PXE Booting Service                       | ✅     | 2023-05 |
| **[OpenSSL](openssl)**                                          | Self-signed certificate generator         | ✅     | 2023-05 |
| **[Pterodactyl Panel](pterodactyl-panel)**                      | GameServer Panel (Beta)                   | ⚠️     | 2023-05 |
| **[Pterodactyl Wings](pterodactyl-wings)**                      | GameServer Wings Daemon                   | ✅     | 2023-05 |
| **[ShieldDNS](ShieldDNS)**                                      | DNS-over-HTTPS & TLS Server               | ✅     | 2026-01 |
| **[ShieldFile](ShieldFile)**                                    | Secure File Sharing                       | ✅     | 2026-01 |
| **[Solumati](solumati)**                                        | Solar Panel Monitoring                    | ✅     | 2026-01 |
| **[Switch LAN Play](switch_lan_play)**                          | Nintendo Switch LAN Play Client           | ✅     | 2023-05 |
| **[Switch LAN Play Server](switch_lan_play_server)**            | Nintendo Switch LAN Play Server           | ✅     | 2023-05 |
| **[Tado Auto Assist](tado_aa)**                                 | Auto-adjust heating based on presence     | ✅     | 2023-05 |
| **[Tuya Convert](.unsupported/tuya-convert)**                   | Flash Tuya devices OTA (Unsupported/Beta) | ❌     | 2023-05 |
| **[WhatsApp](whatsapp)**                                        | Home Assistant WhatsApp Backend (Beta)    | ⚠️     | 2026-01 |
| **[Wiki.js](wiki.js)**                                          | Wiki.js (Stable)                          | ✅     | 2023-05 |
| **[Wiki.js V3](wiki.js3)**                                      | Wiki.js V3 (Beta)                         | ⚠️     | 2026-01 |
| **[xqrepack](.unsupported/xqrepack)**                           | MiWifi Firmware Modifier (Unsupported)    | ❌     | 2023-05 |

<!-- markdownlint-enable MD060 -->
<!-- markdownlint-disable MD028 -->

> **Legend:**
>
> - ✅ = Stable (version ≥ 1.0.0)
> - ⚠️ = Beta (version < 1.0.0, functional but in development)
> - ❌ = Unsupported (no longer maintained)

<!-- markdownlint-enable MD028 -->

---

Found a bug? [Open an issue](https://github.com/FaserF/hassio-addons/issues).
Tested on **amd64** architecture.

---

## 🪦 Unsupported Add-ons Info

To install them, you must add this repository again but point to the `unsupported` branch:

 1. Click to add the unsupported repository:
    [![Add Unsupported Repository](https://my.home-assistant.io/badges/supervisor_add_addon_repository.svg)](https://my.home-assistant.io/redirect/supervisor_add_addon_repository/?repository_url=https%3A%2F%2Fgithub.com%2FFaserF%2Fhassio-addons%23unsupported)

 2. Or manually add:
    ```text
    https://github.com/FaserF/hassio-addons#unsupported
    ```

 > [!CAUTION]
 > **UNSUPPORTED / LEGACY SOFTWARE**
 >
 > The `unsupported` branch contains add-ons that are **no longer maintained**, deprecated, or broken.
 > They are provided "as-is" for archival purposes.
 > Updates are rare, and functionality is not guaranteed.
 > **These builds are performed locally on your device.**

> [!WARNING]
> Unsupported add-ons are **NOT MAINTAINED**. Use them strictly at your own risk.

## 🏆 Platinum Standard Quality

This repository adheres to a **Platinum Standard** for Home Assistant Add-ons, ensuring robust stability, security, and code quality.

Every add-on in this repository undergoes extensive CI/CD verification, including:

- **Automated Builds:** Verified across multiple architectures.
- **Security Scanning:** Proactive checks with [Zizmor](https://github.com/woodruffw/zizmor) and [Hadolint](https://github.com/hadolint/hadolint).
- **Strict Linting:** Enforced by [Add-on Linter](https://github.com/home-assistant/hassio-addons/tree/master/linter), [Actionlint](https://github.com/rhysd/actionlint), [MarkdownLint](https://github.com/DavidAnson/markdownlint), and [ShellCheck](https://github.com/koalaman/shellcheck).
- **Code Consistency:** Automated formatting via [Prettier](https://prettier.io/), [Black](https://github.com/psf/black), and [isort](https://github.com/PyCQA/isort).
- **Local Verification:** Universal testing scripts aimed at reproducible results on any machine.

We strive to provide add-ons that are not just functional, but also secure, maintainable, and reliable.

---

## 📄 License

This project is licensed under the MIT License (c) 2019–2026 FaserF.

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
