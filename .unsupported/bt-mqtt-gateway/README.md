# bt-mqtt-gateway

![Logo](logo.png)

[![Open your Home Assistant instance and show the add-on dashboard.](https://my.home-assistant.io/badges/supervisor_addon.svg)](https://my.home-assistant.io/redirect/supervisor_addon/?addon=c1e285b7_bt-mqtt-gateway)
[![Home Assistant Add-on](https://img.shields.io/badge/home%20assistant-addon-blue.svg)](https://www.home-assistant.io/addons/)
[![GitHub Release](https://img.shields.io/github/v/release/FaserF/hassio-addons?include_prereleases&style=flat-square)](https://github.com/FaserF/hassio-addons/releases)
![Project Maintenance](https://img.shields.io/badge/maintainer-FaserF-blue?style=flat-square)

> Bluetooth MQTT Gateway Server (Unsupported)

---

## 📖 About

![Supports aarch64 Architecture][aarch64-shield]

> [!WARNING]
> Project has been deprecated by the original creator, therefore this Addon
> won't receive new features

Please have a look at the [official repository](https://github.com/zewelor/bt-mqtt-gateway),
it is recommended to use Bluetooth Proxy.

Bluetooth-MQTT-Gateway for Homeassistant OS

A simple Python script which provides a Bluetooth to MQTT gateway, easily
extensible via custom workers.
See [Wiki](https://github.com/zewelor/bt-mqtt-gateway/wiki) for more
information (supported devices, features and much more).

This can be used, to improve the reliability of bluetooth thermostats. See
<https://github.com/home-assistant/core/issues/28601> for more information.

## Installation

The installation of this add-on is pretty straightforward and not different in
comparison to installing any other custom Home Assistant add-on.
Just add my repo to the hassio addons repositorys: <https://github.com/FaserF/hassio-addons>

Put your config file to /share/bt-mqtt-gateway.yaml
Please make sure that a MQTT Addon is being installed already.

---

## ⚙️ Configuration

Configure the add-on via the **Configuration** tab in the Home Assistant add-on page.

### Options

```yaml
config_path: /share/bt-mqtt-gateway.yaml
debug: false
```

---

## 👨‍💻 Credits & License

This project is open-source and available under the MIT License.
Maintained by **FaserF**.
