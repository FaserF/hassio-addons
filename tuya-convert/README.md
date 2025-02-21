# Home Assistant Community Add-on: Tuya-Convert
![Supports aarch64 Architecture][aarch64-shield] ![Supports amd64 Architecture][amd64-shield] ![Supports armhf Architecture][armhf-shield] ![Supports armv7 Architecture][armv7-shield] ![Supports i386 Architecture][i386-shield]
![Project Maintenance][maintenance-shield]

Tuya-Convert for Homeassistant OS

## About

Work has been deprecated!
DO NOT USE RIGHT NOW!!! This was a test, it seems to work, but I wont guarantee anything!

A Chinese company named Tuya offers a free-to-brand turnkey smart home solution to anyone. Using their offer is dead-simple, since everything can be done by clicking through the Tuya web page, from choosing your pre-designed products or pre-programmed wifi-modules (mostly ESP8266) to building your own app. In the end, this has resulted in as they claim over 11 000 devices 'made' by over 10 000 vendors using Tuyas firmware and cloud services.

Aside from that, they claim their cloud solution has 'military grade security'. Michael Steigerwald, founder of the German IT security startup VTRUST, was able to disprove this claim and presented his results in the "Smart home - Smart hack" talk at 35C3 in Leipzig: <https://media.ccc.de/v/35c3-9723-smart_home_-_smart_hack>

In the following days, VTRUST and the German tech magazine c't decided to work together. Since reflashing devices using the ESP8266/85 is widespread among DIY smart home enthusiasts, we wanted to provide an easy way for everyone to free their devices from the cloud without the need for a soldering iron.

Please make sure to visit VTRUST (<https://www.vtrust.de/>), since the hack is their work.

Please prefer using the normal installation of tuya-convert and not this homeassistant-os addon, as it is possible that the risks of bricking is higher. <https://github.com/ct-Open-Source/tuya-convert>

## Installation

[![FaserF Homeassistant Addons](https://my.home-assistant.io/badges/supervisor_add_addon_repository.svg)](https://my.home-assistant.io/redirect/supervisor_add_addon_repository/?repository_url=https%3A%2F%2Fgithub.com%2FFaserF%2Fhassio-addons)
<br />
The installation of this add-on is pretty straightforward and not different in comparison to installing any other custom Home Assistant add-on.<br />
Just click the link above or add my repo to the hassio addons repositorys: <https://github.com/FaserF/hassio-addons>

## Configuration

**Note**: _Remember to restart the add-on when the configuration is changed._

Example add-on configuration:

```yaml
backup_path: /share/tuya-convert
firmware: tasmota.bin
accept_eula: true
```

**Note**: _This is just an example, don't copy and paste it! Create your own!_

### Option: `backup_path`

This option is needed. Change it depending where your firmware backup location should be.

### Option: `firmware`

This option is needed. Change it depending what custom firmware you want to install. You have the option between "tasmota.bin" and "espurna.bin".

### Option: `accept_eula`

This option is needed. The software will only start if you are setting it to true. You can read the EULA agreement from tuya-convert here: <https://github.com/ct-Open-Source/tuya-convert/blob/master/scripts/setup_checks.sh#L18>

## Support

Got questions?

You could [open an issue here][issue] GitHub.
Please keep in mind, that this software is only tested on armv7 running on a Raspberry Pi 4.

## Authors & contributors

The original program is from @ct-Open-Source. For more informatios please visit this page: <https://github.com/ct-Open-Source/tuya-convert>
The hassio addon is brought to you by [FaserF].

## License

MIT License

Copyright (c) 2020 FaserF & ct-Open-Source

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

[aarch64-shield]: https://img.shields.io/badge/aarch64-yes-green.svg
[amd64-shield]: https://img.shields.io/badge/amd64-yes-green.svg
[armhf-shield]: https://img.shields.io/badge/armhf-yes-green.svg
[armv7-shield]: https://img.shields.io/badge/armv7-yes-green.svg
[FaserF]: https://github.com/FaserF/
[i386-shield]: https://img.shields.io/badge/i386-yes-green.svg
[issue]: https://github.com/FaserF/hassio-addons/issues
[maintenance-shield]: https://img.shields.io/maintenance/yes/2020.svg
