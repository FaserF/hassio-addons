# FaserF's Home Assistant Add-ons 🏠

This repository contains a collection of custom **Home Assistant Add-ons**
maintained by FaserF.

> [!NOTE]
> These add-ons are primarily intended for my own private use. I strive to fix bugs or implement feature requests, but I cannot guarantee it. Add-ons that I no longer use myself receive poorer support from me.

## Installation 🚀

1. Click the button below to to add this repository to your Home Assistant.
   [![Install Repository](https://my.home-assistant.io/badges/supervisor_add_addon_repository.svg)](https://my.home-assistant.io/redirect/supervisor_add_addon_repository/?repository_url=https%3A%2F%2Fgithub.com%2FFaserF%2Fhassio-addons)

2. Or manually add this URL:

   ```text
   https://github.com/FaserF/hassio-addons
   ```

## Add-ons List 📦

<!-- markdownlint-disable MD060 -->

| Name                                                            | Description                               | Status |
| :-------------------------------------------------------------- | :---------------------------------------- | :----- |
| **[AegisBot](AegisBot)**                                        | Telegram Bot Management Server            | ✅     |
| **[Apache2](apache2)**                                          | Webserver (Minimal / MariaDB / PHP)       | ✅     |
| **[Apache2 Minimal](apache2-minimal)**                          | Webserver (Minimal / PHP)                 | ✅     |
| **[Apache2 Minimal + MariaDB](apache2-minimal-mariadb)**        | Webserver (Minimal / MariaDB / PHP)       | ✅     |
| **[Bash Script Executer](bash_script_executer)**                | Execute bash scripts in HA OS             | ✅     |
| **[Home Assistant Test Instance](homeassistant-test-instance)** | Nested Home Assistant for Testing         | ✅     |
| **[Matterbridge](matterbridge)**                                | Simple chat bridge                        | ✅     |
| **[Netboot.xyz](netboot-xyz)**                                  | PXE Booting Service                       | ✅     |
| **[OpenSSL](openssl)**                                          | Self-signed certificate generator         | ✅     |
| **[Pterodactyl](pterodactyl-panel)**                            | GameServer Stack (Panel & Wings)          | ✅     |
| **[ShieldDNS](ShieldDNS)**                                      | DNS-over-HTTPS & TLS Server               | ✅     |
| **[ShieldFile](ShieldFile)**                                    | Secure File Sharing                       | ✅     |
| **[Switch LAN Play](switch_lan_play)**                          | Nintendo Switch LAN Play Client           | ✅     |
| **[Switch LAN Play Server](switch_lan_play_server)**            | Nintendo Switch LAN Play Server           | ✅     |
| **[Tado Auto Assist](tado_aa)**                                 | Auto-adjust heating based on presence     | ✅     |
| **[WhatsApp](whatsapp)**                                        | Home Assistant WhatsApp Backend (Baileys) | ✅     |
| **[Wiki.js](wiki.js)**                                          | Wiki.js                                   | ✅     |

<!-- markdownlint-enable MD060 -->

> [!NOTE]
> **Deprecated Add-on:** `bt-mqtt-gateway`, `HyperionNG`, `Silverstrike`, `Tuya-Convert`, `Wiki.js`.

## 🪦 Unsupported / Deprecated

The following add-ons are no longer supported or maintained. They have been moved to the `unsupported/` directory.

- **[BT MQTT Gateway](.unsupported/bt-mqtt-gateway)**
- **[Freenom DNS Updater](.unsupported/freenom-dns-updater)**
- **[HyperionNG](.unsupported/HyperionNG)**
- **[Silverstrike](.unsupported/Silverstrike)**
- **[Tuya Convert](.unsupported/tuya-convert)**
- **[xqrepack](.unsupported/xqrepack)**

### ⚠️ Installing Unsupported Add-ons

Because these add-ons are located in a hidden `.unsupported` directory, they **will not appear** in the Home Assistant Add-on Store even if you add this repository.

To install them, you must do so manually as a **Local Add-on**:

1.  Access your Home Assistant host via SSH or Samba.
2.  Navigate to the `/addons` directory (create it if it doesn't exist, usually separate from `/config`).
3.  Create a folder, e.g., `/addons/local`.
4.  Copy the entire add-on folder (e.g. `bt-mqtt-gateway`) from `.unsupported/` in this repository to `/addons/local/bt-mqtt-gateway`.
5.  In Home Assistant, go to **Settings > Add-ons > Add-on Store**.
6.  Click the **three dots** (top right) -> **Check for updates**.
7.  The add-on should appear in the "Local Add-ons" section.

> [!WARNING]
> These add-ons are **NOT MAINTAINED**. Use them strictly at your own risk. Automatic base image updates still happen through Workflows.


Found a bug? [Open an issue](https://github.com/FaserF/hassio-addons/issues).
Tested on **amd64** architecture.

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
