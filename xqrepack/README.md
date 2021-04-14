# Home Assistant Community Add-on: xqrepack
![Supports aarch64 Architecture][aarch64-shield] ![Supports amd64 Architecture][amd64-shield] ![Supports armhf Architecture][armhf-shield] ![Supports armv7 Architecture][armv7-shield] ![Supports i386 Architecture][i386-shield]
![Project Maintenance][maintenance-shield]

xqrepack - Repack and rebuild MiWifi Images to gain SSH access and other stuff.

## About

These scripts allow you to modify the Xiaomi R3600 (AX3600) / rm1800 (AX1800) firmware image to make sure SSH and UART access is always enabled.

The default root password is password. Please remember to login to the router and change that after the upgrade. Your router settings like IP address and SSIDs are stored in the nvram and should stay the same.

⚠ The script also tries its best to remove or disable phone-home binaries, and also the smart controller (AIoT) parts, leaving you with a (close to) OpenWRT router that you can configure via UCI or /etc/config. Between preserving stock functionality and privacy concerns, I would err on the side of caution and rather that some functionality be sacrificed for a router that I have more confidence to connect to the Internet.

Note that in order to get SSH access to the router initially, you need to downgrade to version 1.0.17 and exploit it first. Once you have SSH, you can use this repacking method to maintain SSH access for newer versions.<br /> 

Please visit @geekman original repo of this program: https://github.com/geekman/xqrepack

## Installation

The installation of this add-on is pretty straightforward and not different in comparison to installing any other custom Home Assistant add-on.<br /> 
Just add my repo to the hassio addons repositorys: https://github.com/FaserF/hassio-addons

The new firmware will be at your "firmware_path" folder and will be called "r3600-raw-img.bin"

## Configuration

**Note**: _Remember to restart the add-on when the configuration is changed._

Example add-on configuration:

### AX3600

```yaml
firmware_path: /share/miwifi_firmware/
firmware_name: miwifi_r3600_firmware_02d97_1.1.15.bin
```
<br /> 

### AX1800

```yaml
firmware_path: /share/miwifi_firmware/
firmware_name: miwifi_rm1800_firmware_df7e3_1.0.385.bin
```
<br /> 

**Note**: _This is just an example, don't copy and paste it! Create your own!_

### Option: `firmware_path`

This option is needed. Change it depending where your firmware files folder is.<br /> 

Note: it has to be somewhere in the /share folder! Other folders are not visible to this addon.

### Option: `firmware_name`

This option is needed. Change it depending what your firmware file is called.<br /> 
NOTE: Please keep the name rm1800 inside the firmware file, if you are using a image for the AX1800. This is needed, as the modifying process for AX1800 is different than for the AX3600!

## Support

Got questions or problems?

You can [open an issue here][issue] GitHub.<br /> 
Please keep in mind, that this software is only tested on armv7 running on a Raspberry Pi 4.

## Authors & contributors

The original program is from @geekman. For more informations please visit this page: https://github.com/geekman/xqrepack
The hassio addon is brought to you by [FaserF].

## License

MIT License

Copyright (c) 2019-2021 FaserF & geekman

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
