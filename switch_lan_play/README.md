# Home Assistant Community Add-on: Nintendo Switch LAN-Play Client
![Supports aarch64 Architecture][aarch64-shield] ![Supports amd64 Architecture][amd64-shield] ![Supports armhf Architecture][armhf-shield] ![Supports armv7 Architecture][armv7-shield] ![Supports i386 Architecture][i386-shield]
![Project Maintenance][maintenance-shield]

Nintendo Switch LAN-Play Client for Homeassistant OS

![The Lan-Play Home Home Assistant Add-on](../_images/switch_lan_play/screenshot.png)

## About

To play with your CFW Nintendo Switch online, you can use this addon + a public or private Server. This addon can be used, to stop running the lan play client on a Desktop PC/Laptop.
This is just the Client Software and NOT the Server Sotware. To use a lan-play server with Homeassistant OS, please have a look at my other addon: <https://github.com/FaserF/hassio-addons/switch_lan_play_server>

This docker image will self-compile the latest lan-play software and run it based on your architecture. More information can be found here: <https://drive.google.com/file/d/1A_4o8HCAfDBFsePcGL3utG-LfzMUovcx/view>
The first installation can take up to 10 minutes because of this! Depending on your hardware.

## Installation

[![FaserF Homeassistant Addons](https://my.home-assistant.io/badges/supervisor_add_addon_repository.svg)](https://my.home-assistant.io/redirect/supervisor_add_addon_repository/?repository_url=https%3A%2F%2Fgithub.com%2FFaserF%2Fhassio-addons)
<br />
The installation of this add-on is pretty straightforward and not different in comparison to installing any other custom Home Assistant add-on.<br />
Just click the link above or add my repo to the hassio addons repositorys: <https://github.com/FaserF/hassio-addons>

## Configuration

**Note**: _Remember to restart the add-on when the configuration is changed._

Example add-on configuration:

```yaml
server: switch.lan-play.com:11452
```

**Note**: _This is just an example, don't copy and paste it! Create your own!_

### Option: `server`

This option is mandatory. Please write here your server you want to connect to with the port added.

**Note**: If you leave this empty there will be issues.

## Support

Got questions?

You could [open an issue here][issue] GitHub.
Please keep in mind, that this software is only tested on armv7 running on a Raspberry Pi 4.

## Authors & contributors

The original program is from spacemeowx2. For more informatios please visit this github: <https://github.com/spacemeowx2/switch-lan-play>
The hassio addon is brought to you by [FaserF].

## License

MIT License

Copyright (c) 2019-2025 FaserF & spacemeowx2

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
[maintenance-shield]: https://img.shields.io/maintenance/yes/2025.svg
