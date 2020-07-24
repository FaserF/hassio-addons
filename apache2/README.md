# Home Assistant Community Add-on: Apache2
![Supports aarch64 Architecture][aarch64-shield] ![Supports amd64 Architecture][amd64-shield] ![Supports armhf Architecture][armhf-shield] ![Supports armv7 Architecture][armv7-shield] ![Supports i386 Architecture][i386-shield]
![Project Maintenance][maintenance-shield]

Apache2 Webserver for Homeassistant OS

![Ingress Support](images/ingress.png)

## About

The Apache HTTP Server Project is an effort to develop and maintain an open-source HTTP server for modern operating systems including UNIX and Windows. The goal of this project is to provide a secure, efficient and extensible server that provides HTTP services in sync with the current HTTP standards.
The Apache HTTP Server ("httpd") was launched in 1995 and it has been the most popular web server on the Internet since April 1996. It has celebrated its 25th birthday as a project in February 2020.
The Apache HTTP Server is a project of The Apache Software Foundation.

This docker image comes with: apache2, apache2-mariadb, apache2-php7.3.18, apache2-ssl

## Installation

The installation of this add-on is pretty straightforward and not different in comparison to installing any other custom Home Assistant add-on.
Just add my repo to the hassio addons repositorys: https://github.com/FaserF/hassio-addons

Put your website files to /share/htdocs
Example File where your index.html should be: /share/htdocs/index.html

If you want to integrate your website with a mariadb database. Please ensure that the MariaDB Addon is installed!

## Configuration

**Note**: _Remember to restart the add-on when the configuration is changed._

Example add-on configuration:

```yaml
document_root: /share/htdocs
website_name: mywebsite.ddns.net
ssl: true
certfile: fullchain.pem
keyfile: privkey.pem
```

**Note**: _This is just an example, don't copy and paste it! Create your own!_

### Option: `document_root`

This option is needed. Change it depending where your root webfolder is on your homeassistant installation.

### Option: `website_name`

This option is needed, if you enable ssl to true. If you are not using SSL put anything in here, as it doesnt matter.

### Option: `ssl`

Enables/Disables SSL (HTTPS) on the web interface of Bookstack
Panel. Set it `true` to enable it, `false` otherwise.

If you need a self-signed certificate, have a look at my openssl addon: https://github.com/FaserF/hassio-addons/openssl

**Note**: _The files MUST be stored in `/ssl/`, which is the default_

## Ingress

This addon supports Homeassistant Ingress. Until now it seems only to work if you enable SSL!
And also I am sorry, but I cant support all your websites. Basic HTML Websites will work great with ingress, the more advanced the page is, the harder it is to support ingress.

## Support

Got questions?

You could [open an issue here][issue] GitHub.
Please keep in mind, that this software is only tested on armv7 running on a Tinkerboard.

## Authors & contributors

The original program is from the Apache Project. For more informatios please visit this page: https://httpd.apache.org/
The hassio addon is brought to you by [FaserF].

## License

MIT License

Copyright (c) 2019-2020 FaserF & The Apache Project

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
[commits]: https://github.com/FaserF/apache2/commits/master
[contributors]: https://github.com/FaserF/hassio-addons/apache2/graphs/contributors
[FaserF]: https://github.com/FaserF/
[i386-shield]: https://img.shields.io/badge/i386-yes-green.svg
[issue]: https://github.com/FaserF/hassio-addons/issues
[repository]: https://github.com/FaserF/hassio-addons/apache2
[maintenance-shield]: https://img.shields.io/maintenance/yes/2020.svg
