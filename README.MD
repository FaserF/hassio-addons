# FaserF's Home Assistant Add-ons 🏠

This repository contains a collection of custom **Home Assistant Add-ons**
maintained by FaserF.

> [!NOTE]
> These add-ons are primarily intended for my own private use. I strive to fix bugs or implement feature requests, but I cannot guarantee it. Add-ons that I no longer use myself receive poorer support from me.

## Installation 🚀

1. Click the button below to add this repository to your Home Assistant.
   [![Install Repository](https://my.home-assistant.io/badges/supervisor_add_addon_repository.svg)](https://my.home-assistant.io/redirect/supervisor_add_addon_repository/?repository_url=https%3A%2F%2Fgithub.com%2FFaserF%2Fhassio-addons)

2. Or manually add this URL:

   ```text
   https://github.com/FaserF/hassio-addons
   ```

## Add-ons List 📦

The table below shows **all add-ons** in this repository, including unsupported ones.

<!-- markdownlint-disable MD060 -->

| Name                                                            | Description                               | Status |
| :-------------------------------------------------------------- | :---------------------------------------- | :----- |
| **[AegisBot](AegisBot)**                                        | Telegram Bot Management Server            | ✅     |
| **[Apache2](apache2)**                                          | Webserver with PHP and MariaDB            | ✅     |
| **[Apache2 Minimal](apache2-minimal)**                          | Webserver (Minimal, no PHP)               | ✅     |
| **[Apache2 Minimal + MariaDB](apache2-minimal-mariadb)**        | Webserver with MariaDB and PHP            | ✅     |
| **[Bash Script Executer](bash_script_executer)**                | Execute bash scripts in HA OS             | ✅     |
| **[BT MQTT Gateway](.unsupported/bt-mqtt-gateway)**             | Bluetooth MQTT Gateway (Unsupported)      | ❌     |
| **[Freenom DNS Updater](.unsupported/freenom-dns-updater)**     | Dynamic DNS Updater (Unsupported)         | ❌     |
| **[Home Assistant Test Instance](homeassistant-test-instance)** | Nested Home Assistant for Testing         | ⚠️     |
| **[Matterbridge](matterbridge)**                                | Simple chat bridge                        | ✅     |
| **[Netboot.xyz](netboot-xyz)**                                  | PXE Booting Service                       | ✅     |
| **[OpenSSL](openssl)**                                          | Self-signed certificate generator         | ✅     |
| **[Pterodactyl Panel](pterodactyl-panel)**                      | GameServer Panel (Beta)                   | ⚠️     |
| **[Pterodactyl Wings](pterodactyl-wings)**                      | GameServer Wings Daemon                   | ✅     |
| **[ShieldDNS](ShieldDNS)**                                      | DNS-over-HTTPS & TLS Server               | ✅     |
| **[ShieldFile](ShieldFile)**                                    | Secure File Sharing                       | ✅     |
| **[Solumati](solumati)**                                        | Solar Panel Monitoring                    | ✅     |
| **[Switch LAN Play](switch_lan_play)**                          | Nintendo Switch LAN Play Client           | ✅     |
| **[Switch LAN Play Server](switch_lan_play_server)**            | Nintendo Switch LAN Play Server           | ✅     |
| **[Tado Auto Assist](tado_aa)**                                 | Auto-adjust heating based on presence     | ✅     |
| **[Tuya Convert](.unsupported/tuya-convert)**                   | Flash Tuya devices OTA (Unsupported/Beta) | ❌     |
| **[WhatsApp](whatsapp)**                                        | Home Assistant WhatsApp Backend (Beta)    | ⚠️     |
| **[Wiki.js](wiki.js)**                                          | Wiki.js                                   | ✅     |
| **[xqrepack](.unsupported/xqrepack)**                           | MiWifi Firmware Modifier (Unsupported)    | ❌     |

<!-- markdownlint-enable MD060 -->
<!-- markdownlint-disable MD028 -->

> **Legend:**
>
> - ✅ = Stable (version ≥ 1.0.0)
> - ⚠️ = Beta (version < 1.0.0, functional but in development)
> - ❌ = Unsupported (no longer maintained)

<!-- markdownlint-enable MD028 -->

## 🪦 Unsupported Add-ons Info

Add-ons marked with ❌ are located in the `.unsupported/` directory and **will not appear** in the Home Assistant Add-on Store.

To install them manually as a **Local Add-on**:

1. Access your Home Assistant host via SSH or Samba.
2. Navigate to the `/addons` directory (create it if it doesn't exist).
3. Create a folder, e.g., `/addons/local`.
4. Copy the entire add-on folder from `.unsupported/` to `/addons/local/`.
5. In Home Assistant, go to **Settings > Add-ons > Add-on Store**.
6. Click the **three dots** (top right) -> **Check for updates**.
7. The add-on should appear in the "Local Add-ons" section.

> [!WARNING]
> Unsupported add-ons are **NOT MAINTAINED**. Use them strictly at your own risk.

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
