# Home Assistant Community Add-on: Wiki.js
![Supports aarch64 Architecture][aarch64-shield] ![Supports amd64 Architecture][amd64-shield] ![Supports armhf Architecture][armhf-shield] ![Supports armv7 Architecture][armv7-shield] ![Supports i386 Architecture][i386-shield]
![Project Maintenance][maintenance-shield]

Wiki.js for Homeassistant OS

## About

The most powerful and extensible open source Wiki software.
Make documentation a joy to write using Wiki.js's beautiful and intuitive interface!

## Installation

The installation of this add-on is pretty straightforward and not different in comparison to installing any other custom Home Assistant add-on.<br /> 
Just add my repo to the hassio addons repositorys: https://github.com/FaserF/hassio-addons

Please ensure that the MariaDB Addon is installed!

## Configuration

**Note**: _Remember to restart the add-on when the configuration is changed._

Example add-on configuration:

```yaml
ssl: true
certfile: fullchain.pem
keyfile: privkey.pem
```

**Note**: _This is just an example, don't copy and paste it! Create your own!_

### Option: `ssl`

Enables/Disables SSL (HTTPS) on the web interface. Set it `true` to enable it, `false` otherwise.

If you need a self-signed certificate, have a look at my openssl addon: https://github.com/FaserF/hassio-addons/tree/master/openssl

**Note**: _The files MUST be stored in `/ssl/`, which is the default_

## Ingress

This addon currently does not fully support ingress! Hopefully that will come soon.

## Support

Got questions or problems?

You can [open an issue here][issue] GitHub.
Please keep in mind, that this software is only tested on armv7 running on a Raspberry Pi 4.

## Authors & contributors

The original program is from the Requarks Team [NGPixel][NGPixel]. For more informatios please visit this page: https://github.com/Requarks/wiki
The hassio addon is brought to you by [FaserF].

## License

MIT License

Copyright (c) 2021 FaserF & Requarks

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

[maintenance-shield]: https://img.shields.io/maintenance/yes/2021.svg
[aarch64-shield]: https://img.shields.io/badge/aarch64-yes-green.svg
[amd64-shield]: https://img.shields.io/badge/amd64-yes-green.svg
[armhf-shield]: https://img.shields.io/badge/armhf-yes-green.svg
[armv7-shield]: https://img.shields.io/badge/armv7-yes-green.svg
[i386-shield]: https://img.shields.io/badge/i386-yes-green.svg
[FaserF]: https://github.com/FaserF/
[issue]: https://github.com/FaserF/hassio-addons/issues
[repository]: https://github.com/FaserF/hassio-addons/wiki.js
[NGPixel]: https://github.com/NGPixel