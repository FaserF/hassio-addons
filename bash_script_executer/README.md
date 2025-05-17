# Home Assistant Community Add-on: Bash Script Executer
![Supports aarch64 Architecture][aarch64-shield] ![Supports amd64 Architecture][amd64-shield] ![Supports armhf Architecture][armhf-shield] ![Supports armv7 Architecture][armv7-shield] ![Supports i386 Architecture][i386-shield]
![Project Maintenance][maintenance-shield]

Bash Script Executer for Homeassistant OS

## About

This is a simple Docker Image to execute personal scripts. The reason I am needing this, is that the HA OS has limited features installed (for example no curl, sed etc) and this Addon fixes that issue.<br />
You can run up to three different scripts with this addon.<br />
This docker image comes with: busybox-extras curl grep coreutils sed xmlstarlet

## Installation

[![FaserF Homeassistant Addons](https://my.home-assistant.io/badges/supervisor_add_addon_repository.svg)](https://my.home-assistant.io/redirect/supervisor_add_addon_repository/?repository_url=https%3A%2F%2Fgithub.com%2FFaserF%2Fhassio-addons)
<br />
The installation of this add-on is pretty straightforward and not different in comparison to installing any other custom Home Assistant add-on.<br />
Just click the link above or add my repo to the hassio addons repositorys: <https://github.com/FaserF/hassio-addons>

Put your scripts somewhere in the /share/ folder. Other folders are not visible to this addon.<br />
Example File where your script could be: /share/scripts/script.sh

## Configuration

**I am recommending to disable "Start on boot" and the Watchdog option from HA for this addon!**<br />

**Note**: _Remember to restart the add-on when the configuration is changed._

Example add-on configuration:

```yaml
script_path: /share/scripts/script.sh
script_argument1: myFirstArgument
script_argument2: AnotherVariable
script_argument3: AnotherVariable
script_path2: false
script2_argument1:
script2_argument2:
script2_argument3:
script_path3: false
script3_argument2:
script3_argument2:
script3_argument3:
```

**Note**: _This is just an example, don't copy and paste it! Create your own!_

### Option: `script_path`

This option is needed. Change it depending where your script is or change it to "false" to leave it empty.

### Option: `scriptX_argumentX`

This option is optional. You can submit up to three arguments to your script with this option.

### Option: `script_path2`

This option is needed. Change it depending where your script is or change it to "false" to leave it empty.

### Option: `script_path3`

This option is needed. Change it depending where your script is or change it to "false" to leave it empty.

## Cron Support - running scripts by time

I havent implemented Cron in this addon, as you can run your scripts periodically by an Homeassistant automation.
Example Automation: <br />

```yaml
  - alias: "Run Bash Script with Addon Bash Script Executer"
    trigger:
      - platform: time
        at: '00:02:00'
      - platform: time_pattern
        minutes: '/90'
        seconds: 0
    action:
      - service: hassio.addon_start
        data:
          addon: 605cee21_bashscriptexecuter
```

## Support

Got questions or problems?

You can [open an issue here][issue] GitHub.
Please keep in mind, that this software is only tested on armv7 running on a Raspberry Pi 4. And that I have made this addon for my personal scripts.

## Authors & contributors

The hassio addon is brought to you by [FaserF].

## License

MIT License

Copyright (c) 2025 FaserF

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

[maintenance-shield]: https://img.shields.io/maintenance/yes/2025.svg
[aarch64-shield]: https://img.shields.io/badge/aarch64-yes-green.svg
[amd64-shield]: https://img.shields.io/badge/amd64-yes-green.svg
[armhf-shield]: https://img.shields.io/badge/armhf-yes-green.svg
[armv7-shield]: https://img.shields.io/badge/armv7-yes-green.svg
[i386-shield]: https://img.shields.io/badge/i386-yes-green.svg
[FaserF]: https://github.com/FaserF/
[issue]: https://github.com/FaserF/hassio-addons/issues
