# Home Assistant Community Add-on: pterodactyl Panel
![Supports aarch64 Architecture][aarch64-shield] ![Supports amd64 Architecture][amd64-shield]
![Project Maintenance][maintenance-shield]

pterodactyl Panel Gameserver for Homeassistant OS

![Ingress Support](../_images/pterodactyl/ingress.png)

## About

**WARNING: Currently only limited working. Right now it can be considered beta and unstable. Don't blame me if your gameservers would be lost etc.**
**For me I am unable to login until now. Seems to have something to do with redis, but I dont get what exactly.**

Pterodactyl® is a free, open-source game server management panel built with PHP, React, and Go. Designed with security in mind, Pterodactyl runs all game servers in isolated Docker containers while exposing a beautiful and intuitive UI to end users.<br />
Stop settling for less. Make game servers a first class citizen on your platform.

## Installation

[![FaserF Homeassistant Addons](https://my.home-assistant.io/badges/supervisor_add_addon_repository.svg)](https://my.home-assistant.io/redirect/supervisor_add_addon_repository/?repository_url=https%3A%2F%2Fgithub.com%2FFaserF%2Fhassio-addons)
<br />
The installation of this add-on is pretty straightforward and not different in comparison to installing any other custom Home Assistant add-on.<br />
Just click the link above or add my repo to the hassio addons repositorys: <https://github.com/FaserF/hassio-addons>

## Configuration

The MariaDB Integration is needed before installing this one!

Afterwards create a new user in the MariaDB Addon called "pterodactyl" with full permissions on the database "panel"

**Note**: _Remember to restart the add-on when the configuration is changed._

Example add-on configuration:

```yaml
password: your_MariaDB_password
ssl: false
certfile: itdoesntmatter_as_ssl_is_set_to_false
keyfile: itdoesntmatter_as_ssl_is_set_to_false
```
<br />
Recommended Example add-on configuration:

```yaml
password: your_MariaDB_password
ssl: true
certfile: fullchain.pem
keyfile: privkey.pem
```

**Note**: _This is just an example, don't copy and paste it! Create your own!_

### Option: `password`

This option is required. The password for the mariadb "pterodactyl" user.

### Option: `ssl`

Enables/Disables SSL (HTTPS) on the web interface.

If you need a self-signed certificate, have a look at my openssl addon: <https://github.com/FaserF/hassio-addons/tree/master/openssl>

**Note**: _The files MUST be stored in `/ssl/`, which is the default_

### Option: `reset_database`

Enables it to reset the database files for pterodactyl. Please not this action can not be undone! Use it with care.

### Option: `password`

This option is required. Your MariaDB password for the pterodactyl user.

**Note**: _The file MUST be stored somewhere within the `/share/` folder_

## Default Login Credentials

E-Mail: <admin@example.com>
Username: admin
Password: the password defined in the option `password`

## Ingress

This addon will support Homeassistant Ingress. Until now it is work in progress!

## Support

Got questions or problems?

You can [open an issue here][issue] GitHub.
Please keep in mind, that this software is only tested on armv7 running on a Raspberry Pi 4.

## Authors & contributors

The original program is from the pterodactyl Project. For more informatios please visit this page: <https://pterodactyl.io/>
The hassio addon is brought to you by [FaserF].

## License

MIT License

Copyright (c) 2019-2022 FaserF & pterodactyl Project

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

[maintenance-shield]: https://img.shields.io/maintenance/yes/2023.svg
[aarch64-shield]: https://img.shields.io/badge/aarch64-yes-green.svg
[amd64-shield]: https://img.shields.io/badge/amd64-yes-green.svg
[FaserF]: https://github.com/FaserF/
[issue]: https://github.com/FaserF/hassio-addons/issues