# Home Assistant Community Add-on: Tado Auto-Assist for Geofencing and Open Window Detection

![Supports aarch64 Architecture][aarch64-shield]
![Supports amd64 Architecture][amd64-shield]
![Supports armhf Architecture][armhf-shield]
![Supports armv7 Architecture][armv7-shield]
![Project Maintenance][maintenance-shield]

Tado Auto-Assist for Geofencing and Open Window Detection for Home Assistant OS

## About

A Python script that automatically adjusts the temperature in your home based on
your presence (arriving or leaving), using your settings from the Tado app. It
also switches off the heating (activates Open Window Mode) in any room where a
Tado TRV detects an open window.

## Installation

[![FaserF Home Assistant Add-ons](https://my.home-assistant.io/badges/supervisor_add_addon_repository.svg)](https://my.home-assistant.io/redirect/supervisor_add_addon_repository/?repository_url=https%3A%2F%2Fgithub.com%2FFaserF%2Fhassio-addons)

The installation of this add-on is straightforward and similar to installing any other custom Home Assistant add-on.

Just click the link above or manually add this repository to your Home Assistant add-on repositories:
<https://github.com/FaserF/hassio-addons>

## Configuration

Example add-on configuration:

```yaml
username: my@email.com
password: mySecretPassword
minTemp: 5 # Optional – Minimum temperature to set
maxTemp: 25 # Optional – Maximum temperature to set
```

> **Note**: _This is just an example. Please use your own credentials and desired temperature settings._

### Option: `username`

Defines your Tado username (usually your email address).

### Option: `password`

Defines your Tado password.

### Option: `minTemp`

Optional. Defines the minimum temperature that Tado should set when you're away.

### Option: `maxTemp`

Optional. Defines the maximum temperature that Tado should set when you return home.

## Support

Got questions or problems?
You can [open an issue on GitHub][issue] if you encounter any problems or have suggestions.

⚠️ **Please note:** This add-on has only been tested on `armv7` (Raspberry Pi 4).

## Credits

This add-on is based on the work of [adrianslabu], who created the original Python script:
➡️ <https://github.com/adrianslabu/tado_aa>

The Home Assistant add-on wrapper was created and is maintained by [FaserF].

[maintenance-shield]: https://img.shields.io/maintenance/yes/2025.svg
[aarch64-shield]: https://img.shields.io/badge/aarch64-yes-green.svg
[amd64-shield]: https://img.shields.io/badge/amd64-yes-green.svg
[armhf-shield]: https://img.shields.io/badge/armhf-yes-green.svg
[armv7-shield]: https://img.shields.io/badge/armv7-yes-green.svg
[FaserF]: https://github.com/FaserF/
[issue]: https://github.com/FaserF/hassio-addons/issues
[adrianslabu]: https://github.com/adrianslabu
