# Tado Auto Assist

![Logo](logo.png)

[![Open your Home Assistant instance and show the add-on dashboard.](https://my.home-assistant.io/badges/supervisor_addon.svg)](https://my.home-assistant.io/redirect/supervisor_addon/?addon=c1e285b7_tado_aa)
[![Home Assistant Add-on](https://img.shields.io/badge/home%20assistant-addon-blue.svg)](https://www.home-assistant.io/addons/)
[![GitHub Release](https://img.shields.io/github/v/release/FaserF/hassio-addons?include_prereleases&style=flat-square)](https://github.com/FaserF/hassio-addons/releases)
![Project Maintenance](https://img.shields.io/badge/maintainer-FaserF-blue?style=flat-square)

> Tado Auto-Assist for Geofencing and open Window detection

---

## 📖 About

<!-- markdownlint-disable MD013 -->

Tado Auto-Assist for Geofencing and Open Window Detection for Home Assistant OS

A Python script that automatically adjusts the temperature in your home based on
your presence (arriving or leaving), using your settings from the Tado app. It
also switches off the heating (activates Open Window Mode) in any room where a
Tado TRV detects an open window.

## Installation

The installation of this add-on is straightforward and similar to installing any
other custom Home Assistant add-on.

Just click the badge above to add this repository to your Home Assistant,
or manually add the following URL to your add-on repositories:
<https://github.com/FaserF/hassio-addons>

---

## ⚙️ Configuration

Configure the add-on via the **Configuration** tab in the Home Assistant add-on page.

### Options

```yaml
log_level: info
maxTemp: 25
minTemp: 5
password: ''
username: ''
```

---

## 📂 Folder Usage

- `/data`: Used internally by the add-on for persistent meta-data storage and session information.

---

## 👨‍💻 Credits & License

This project is open-source and available under the MIT License.
Maintained by **FaserF**.
