# Bash Script Executer

![Logo](logo.png)

[![Open your Home Assistant instance and show the add-on dashboard.](https://my.home-assistant.io/badges/supervisor_addon.svg)](https://my.home-assistant.io/redirect/supervisor_addon/?addon=c1e285b7_bash_script_executer)
[![Home Assistant Add-on](https://img.shields.io/badge/home%20assistant-addon-blue.svg)](https://www.home-assistant.io/addons/)
[![GitHub Release](https://img.shields.io/github/v/release/FaserF/hassio-addons?include_prereleases&style=flat-square)](https://github.com/FaserF/hassio-addons/releases)
![Project Maintenance](https://img.shields.io/badge/maintainer-FaserF-blue?style=flat-square)
[![View in Code Wiki](https://img.shields.io/badge/View_in-Code_Wiki-8A2BE2?style=flat-square&logo=google&logoColor=white)](https://codewiki.google/github.com/FaserF/hassio-addons/tree/master/bash_script_executer)

> Execute your own bash scripts inside this Homeassistant Addon environment.

---

## 📖 About

Bash Script Executer for Homeassistant OS

This is a simple Docker Image to execute personal scripts. The reason I am
needing this, is that the HA OS has limited features installed (for example
no curl, sed etc) and this Addon fixes that issue.

You can run up to three different scripts with this addon.

This docker image comes with: busybox-extras curl grep coreutils sed xmlstarlet

## Installation

The installation of this add-on is pretty straightforward and not different in
comparison to installing any other custom Home Assistant add-on.

Just click the link above or add my repo to the hassio addons repositorys: <https://github.com/FaserF/hassio-addons>

Put your scripts somewhere in the /share/ folder. Other folders are not visible
to this addon.

Example File where your script could be: /share/scripts/script.sh

---

## ⚙️ Configuration

Configure the add-on via the **Configuration** tab in the Home Assistant add-on page.

### Options

```yaml
script_path: /share/scripts/mycoolscript.sh
script_path2: 'false'
script_path3: 'false'
```

---

## 👨‍💻 Credits & License

This project is open-source and available under the MIT License.
Maintained by **FaserF**.
