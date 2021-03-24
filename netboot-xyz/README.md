# Home Assistant Community Add-on: Netboot.xyz
![Supports aarch64 Architecture][aarch64-shield] ![Supports amd64 Architecture][amd64-shield] ![Supports armhf Architecture][armhf-shield] ![Supports armv7 Architecture][armv7-shield] ![Supports i386 Architecture][i386-shield]
![Project Maintenance][maintenance-shield]

Netboot.xyz PXE Server for Homeassistant OS

## About

netboot.xyz is a way to PXE boot various operating system installers or utilities from one place within the BIOS without the need of having to go retrieve the media to run the tool. iPXE is used to provide a user friendly menu from within the BIOS that lets you easily choose the operating system you want along with any specific types of versions or bootable flags.

You can remote attach the ISO to servers, set it up as a rescue option in Grub, or even set up your home network to boot to it by default so that it’s always available.

## Installation

The installation of this add-on is pretty straightforward and not different in comparison to installing any other custom Home Assistant add-on.<br /> 
Just add my repo to the hassio addons repositorys: https://github.com/FaserF/hassio-addons

## Configuration

**Note**: _Remember to restart the add-on when the configuration is changed._

Example add-on configuration:

```yaml
path: /media/netboot-image
path_config: /media/netboot-config
dhcp_range: 192.168.178.200
```
<br /> 

**Note**: _This is just an example, don't copy and paste it! Create your own!_

### Option: `path`

This option is needed. Change it depending where your ISO files and more are.

Note: it has to be somewhere in the /media folder! Other folders are not visible to this addon.

### Option: `path_config`

This option is needed. Change it depending where your netboot.xyz config files and more are.

Note: it has to be somewhere in the /media folder! Other folders are not visible to this addon.

### Option: `dhcp_range`

This option is needed. Change it depending to your network. Try using a higher IP in the last range (f.e. 100 or 200)

## Ingress

This addon supports Homeassistant Ingress. But it seems to be buggy.

## Post-Installation
Before booting for the first time, I recommend having a look at the netboot config.<br /> 
Go to http://YOUR-HOMEASSISTANT-IP:3000 -> Menus -> boot.cfg<br /> 

### Windows
Change the following line depending to your WinPE location: <br /> 
set win_base_url http://YOUR-SERVER-IP:PORT/WinPE <br /> 

example if you are hosting your extracted files directly on the netboot.xyz server: <br /> 
set win_base_url ${live_endpoint}/windows <br /> 

More informations: <br /> 
https://netboot.xyz/faq/windows/

## Support

Got questions or problems?

You can [open an issue here][issue] GitHub.
Please keep in mind, that this software is only tested on armv7 running on a Raspberry Pi 4.

## Authors & contributors

The original program is from the Netboot.xyz Project. For more informatios please visit this page: https://netboot.xyz/
The hassio addon is brought to you by [FaserF].

## License

MIT License

Copyright (c) 2019-2021 FaserF & Netboot.xyz Project

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