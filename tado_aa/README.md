# Home Assistant Community Add-on: Tado Auto-Assist for Geofencing and Open Window Detection
![Supports aarch64 Architecture][aarch64-shield] ![Supports amd64 Architecture][amd64-shield] ![Supports armhf Architecture][armhf-shield] ![Supports armv7 Architecture][armv7-shield]
![Project Maintenance][maintenance-shield]

Tado Auto-Assist for Geofencing and Open Window Detection for Homeassistant OS

## About

A python script that automatically adjusts the temperature in your home at leaving or arriving based on your settings from tado app and automatically switch off the heating (activating Open Window Mode) in the room where tado TRV detects an open window.

## Installation

[![FaserF Homeassistant Addons](https://my.home-assistant.io/badges/supervisor_add_addon_repository.svg)](https://my.home-assistant.io/redirect/supervisor_add_addon_repository/?repository_url=https%3A%2F%2Fgithub.com%2FFaserF%2Fhassio-addons)
<br />
The installation of this add-on is pretty straightforward and not different in comparison to installing any other custom Home Assistant add-on.<br />
Just click the link above or add my repo to the hassio addons repositorys: <https://github.com/FaserF/hassio-addons>

## Configuration

**Note**: _Remember to restart the add-on when the configuration is changed._

Example add-on configuration:

```yaml
username: my@email.com
password: mySecretPassword
minTemp: 5
maxTemp: 25
```

**Note**: _This is just an example, don't copy and paste it! Create your own!_

### Option: `username`

Defines your tado username (usually your email address).

### Option: `password`

Defines your tado password.

### Option: `minTemp`

Defines your minimal Temperature Tado should set. (Optional)

### Option: `maxTemp`

Defines your maximal Temperature Tado should set. (Optional)

## Support

Got questions or problems?

You can [open an issue here][issue] GitHub.
Please keep in mind, that this software is only tested on armv7 running on a Raspberry Pi 4.

## Authors & contributors

The original program is from [adrianslabu]. For more informations, please visit this page: <https://github.com/adrianslabu/tado_aa>
The hassio addon is brought to you by [FaserF].

[maintenance-shield]: https://img.shields.io/maintenance/yes/2024.svg
[aarch64-shield]: https://img.shields.io/badge/aarch64-yes-green.svg
[amd64-shield]: https://img.shields.io/badge/amd64-yes-green.svg
[armhf-shield]: https://img.shields.io/badge/armhf-yes-green.svg
[armv7-shield]: https://img.shields.io/badge/armv7-yes-green.svg
[FaserF]: https://github.com/FaserF/
[issue]: https://github.com/FaserF/hassio-addons/issues
[adrianslabu]: https://github.com/adrianslabu