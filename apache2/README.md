# Apache2 Webserver Add-on for Home Assistant OS
![Supports aarch64 Architecture][aarch64-shield] ![Supports amd64 Architecture][amd64-shield] ![Supports armhf Architecture][armhf-shield] ![Supports armv7 Architecture][armv7-shield] ![Supports i386 Architecture][i386-shield]
![Project Maintenance][maintenance-shield]

![Ingress Support](../_images/apache2/ingress.png)

A lightweight Apache2 webserver add-on for Home Assistant OS, with optional PHP 8 and MariaDB support.

This add-on allows you to serve static or dynamic websites, run PHP-based applications, or expose internal services via a web interface. Multiple versions are available to fit different needs and use cases.

---

## 📋 Table of Contents

- [About](#about)
- [Versions](#versions)
- [Installation](#installation)
- [Configuration](#configuration)
- [Authentication](#authentication)
- [Ingress](#ingress)
- [MariaDB Usage](#mariadb-usage)
- [Limitations](#limitations)
- [Support](#support)
- [License](#license)

---

## 📖 About

This add-on provides the [Apache HTTP Server](https://httpd.apache.org/) for Home Assistant OS. It supports:

- Hosting static HTML/CSS/JS websites
- Running PHP applications (e.g. dashboards, tools)
- Optional MariaDB integration (e.g. for WordPress, phpMyAdmin)

The Apache HTTP Server is an open-source web server software maintained by the Apache Software Foundation.

---

## 🧰 Versions

| Version                                                                                          | Features                                                                     |
|--------------------------------------------------------------------------------------------------|------------------------------------------------------------------------------|
| [Full](https://github.com/FaserF/hassio-addons/tree/master/apache2)                              | Apache2, PHP 8.4 (with common extensions), MariaDB client, ffmpeg, Mosquitto |
| [Minimal](https://github.com/FaserF/hassio-addons/tree/master/apache2-minimal)                   | Apache2 only                                                                 |
| [Minimal + MariaDB](https://github.com/FaserF/hassio-addons/tree/master/apache2-minimal-mariadb) | Apache2, MariaDB client, PHP with basic modules                              |

---

## 🚀 Installation

1. Add the repository to Home Assistant:
   [![Add Repository](https://my.home-assistant.io/badges/supervisor_add_addon_repository.svg)](https://my.home-assistant.io/redirect/supervisor_add_addon_repository/?repository_url=https%3A%2F%2Fgithub.com%2FFaserF%2Fhassio-addons)

2. Install the `Apache2` add-on via Supervisor.

3. Place your website files in document_root (Default: `/share/htdocs`).
   Example: `/share/htdocs/index.html`

4. Start the add-on and access your site via Ingress or external port.

---

## ⚙️ Configuration

```yaml
document_root: /share/htdocs               # Required
php_ini: default                           # "default", "get_file" or path
default_conf: default                      # Apache default config
default_ssl_conf: default                  # Apache SSL config
website_name: mydomain.local               # Required if ssl is true
username: apache                           # Optional, changes file ownership
password: mySecretPassword                 # Optional, for internal file access
ssl: true                                  # Enable HTTPS
certfile: fullchain.pem                    # Required if ssl is true
keyfile: privkey.pem                       # Required if ssl is true
init_commands:                             # Optional startup commands
  - apk add imagemagick
```

You can create your own configuration files and PHP.ini using `get_file` to pull them from `/share`.

### Option: `document_root`

This option is needed. Change it depending where your root webfolder is on your homeassistant installation.

Note: it has to be somewhere in the /share or /media folder! Other folders are not visible to this addon.

### Option: `php_ini`

You can choose between the following options:

default → Uses the built-in PHP 8.4 configuration file (recommended)

get_file → Copies the default PHP 8.4 `php.ini` to `/share/apache2addon_php.ini`

path/to/your/new/php.ini -> Please change the location depending where your custom php.ini file is, f.e.: /share/apache2/php.ini

### Option: `default_conf` & `default_ssl_conf`

You can choose between the following options:

default -> the default apache2 addon file will be used

get_config -> Get a copy of the default apache2 addon config file to your /share folder.

path/to/your/new/apache2.conf -> Please change the location depending where your custom 000-default.conf / 000-default-le-ssl.conf file is, f.e.: /share/apache2/000-default.conf <br />
More Information: <https://cwiki.apache.org/confluence/display/HTTPD/ExampleVhosts><br /> <br />
Please note, that I wont give any support if you are using custom apache2 config files and are receiving any apache2 errors!

### Option: `website_name`

This option is needed, if you enable ssl to true. If you are not using SSL put anything in here, as it doesn’t matter.

### Option: `username`

This option is optional. This user is for accessing web files (NOT the website itself). It will change the owner of all web files from "root" to this new owner.

This is NOT used for Authentication for your website. If you want this have a look at [Authentication for your website](#Authentication-for-your-website)

### Option: `password`

This option is optional. Some self hosted web sites require an Authentication password to access files within the docker image. #50

This is NOT used for Authentication for your website. If you want this have a look at [Authentication for your website](#Authentication-for-your-website)

### Option: `ssl`

Enables/Disables SSL (HTTPS) on the web interface.

If you need a self-signed certificate, have a look at my openssl addon: <https://github.com/FaserF/hassio-addons/tree/master/openssl>

**Note**: _The files MUST be stored in `/ssl/`, which is the default_

### Option: `init_commands`

This option is optional. If you need some special packages or commands, you can use this option to install/use them. #124

If you are encountering any issues, please remove this option before submitting a bug report!

### Config example

Recommended Example add-on configuration:

```yaml
document_root: /share/htdocs
php_ini: default
default_conf: default
default_ssl_conf: default
website_name: mywebsite.com
ssl: true
certfile: fullchain.pem
keyfile: privkey.pem
```

---

## 🔐 Authentication

The `username` and `password` fields are used to protect files in the `/share/apache` directory (e.g. configuration or logs). They are **not** used for the actual hosted web pages.

To protect web content, use `.htaccess` and `.htpasswd` files.

### Example: Create `.htpasswd`

```bash
htpasswd -c /share/htdocs/.htpasswd myuser
```

Then reference it in your `.htaccess` file like this:

```
AuthType Basic
AuthName "Restricted Content"
AuthUserFile /share/htdocs/.htpasswd
Require valid-user
```

---

## 🧩 Ingress

The add-on supports ingress (access via Home Assistant UI). However, note:

- Basic HTML pages work perfectly.
- Complex apps using full authentication, redirect chains, or WebSockets may not work well in ingress.
- For best compatibility, access via local IP and exposed port is recommended.

---

## 🐬 MariaDB Usage

If you want to connect your PHP application (e.g. WordPress or phpMyAdmin) to the official MariaDB add-on:

- Use `core-mariadb` as the host name.
- Port: `3306`
- Username/Password: Use Home Assistant MariaDB credentials
- Database name: `homeassistant` (by default)

Example config in PHP:

```php
$mysqli = new mysqli("core-mariadb", "user", "pass", "homeassistant");
```

---

## ⚠️ Limitations

- ✅ Only tested on amd64 (other architectures may work, but are untested)
- ⚠️ PHP support only in the **Full** version
- 🔒 SSL requires valid certificates in `/ssl/`
- 🌐 Not recommended to expose directly to the internet without additional hardening
- 🧩 WordPress compatibility is limited — please consider [dedicated WordPress add-ons](https://github.com/FaserF/hassio-addons/pull/202)

---

## 🙋 Support

Please open an issue on GitHub if you experience problems or have feature requests:
👉 [GitHub Issues](https://github.com/FaserF/hassio-addons/issues)

---

## 📝 License

This project is licensed under the MIT License.

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