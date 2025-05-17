# 🏠 Home Assistant Community Add-ons by FaserF

## 📖 About

This repository contains custom add-ons for [Home Assistant OS](https://www.home-assistant.io/installation/), formerly known as Hass.io. Each subfolder includes a Docker-based add-on ready to install and use.

---

## 🚀 Installation

[![Install Repository](https://my.home-assistant.io/badges/supervisor_add_addon_repository.svg)](https://my.home-assistant.io/redirect/supervisor_add_addon_repository/?repository_url=https%3A%2F%2Fgithub.com%2FFaserF%2Fhassio-addons)

To install, click the badge above or manually add the repository URL in Home Assistant:

```
https://github.com/FaserF/hassio-addons
```

---

## 📦 Add-On List

| Name                      | Description                                                                                           | Link                                                                                               | Support  |
|---------------------------|-------------------------------------------------------------------------------------------------------|----------------------------------------------------------------------------------------------------|----------|
| **Apache2**               | Webserver add-on in 3 variants: minimal, MariaDB support, or full PHP stack                          | [🔗 Overview](https://github.com/FaserF/hassio-addons/tree/master/apache2)                         | ✅        |
| **Bash Script Executer**  | Execute custom bash scripts inside Home Assistant OS                                                  | [🔗 Repo](https://github.com/FaserF/hassio-addons/tree/master/bash_script_executer)               | ✅        |
| **bt-mqtt-gateway**       | Bluetooth to MQTT Gateway                                                                             | [🔗 Repo](https://github.com/FaserF/hassio-addons/tree/master/bt-mqtt-gateway)                    | ❌ (Deprecated) |
| **Freenom DNS Updater**   | Updates Freenom DNS records from within Home Assistant                                                | [🔗 Repo](https://github.com/FaserF/hassio-addons/tree/master/freenom-dns-updater)                | ✅        |
| **HyperionNG**            | LED Control via GPIO (deprecated)                                                                     | [🔗 Use this instead](https://github.com/petersendev/hassio-addons/tree/master/hyperion)          | ❌ (Deprecated) |
| **Matterbridge**          | Simple chat bridge                                                                                    | [🔗 Repo](https://github.com/FaserF/hassio-addons/tree/master/matterbridge)                       | ✅        |
| **Netboot.xyz**           | PXE Booting Service                                                                                   | [🔗 Repo](https://github.com/FaserF/hassio-addons/tree/master/netboot-xyz)                        | ✅        |
| **OpenSSL**               | Self-signed certificate generation tool                                                               | [🔗 Repo](https://github.com/FaserF/hassio-addons/tree/master/openssl)                            | ✅        |
| **Pterodactyl**           | Open-source GameServer stack (Panel + Wings)                                                          | [🔗 Panel](https://github.com/FaserF/hassio-addons/tree/master/pterodactyl-panel), [🔗 Wings](https://github.com/FaserF/hassio-addons/tree/master/pterodactyl-wings) | ✅ |
| **Silverstrike**          | Personal finance manager (deprecated)                                                                 | [🔗 Repo](https://github.com/FaserF/hassio-addons/tree/master/silverstrike)                       | ❌        |
| **Switch LAN Play (Client)** | Nintendo Switch LAN Play Client for modded devices                                               | [🔗 Repo](https://github.com/FaserF/hassio-addons/tree/master/switch_lan_play)                    | ✅        |
| **Switch LAN Play (Server)** | Nintendo Switch LAN Play Server                                                                   | [🔗 Repo](https://github.com/FaserF/hassio-addons/tree/master/switch_lan_play_server)             | ✅        |
| **Tado Auto Assist**      | Python script to auto-adjust heating based on Tado presence and window state                         | [🔗 Repo](https://github.com/FaserF/hassio-addons/tree/master/tado_aa)                            | ✅        |
| **Tuya-Convert**          | Flash Tuya IoT devices with open firmware                                                             | [🔗 Repo](https://github.com/FaserF/hassio-addons/tree/master/tuya-convert)                       | ❌        |
| **Wiki.js**               | Powerful open-source Wiki software                                                                    | [🔗 Use this fork](https://github.com/jdeath/homeassistant-addons/tree/main/wikijs)               | ❌        |
| **xqrepack**              | Patch Xiaomi R3600 firmware for SSH/UART access                                                      | [🔗 Repo](https://github.com/FaserF/hassio-addons/tree/master/xqrepack)                           | ✅        |

---

## 🙋‍♂️ Support

Got questions or issues? [Open an issue on GitHub](https://github.com/FaserF/hassio-addons/issues).
Note: This software is only tested on `amd64` using a **Fujitsu Futro S740**.

---

## 📄 License

This project is licensed under the MIT License (c) 2019–2025 FaserF.

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