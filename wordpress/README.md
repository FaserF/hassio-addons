# Home Assistant Community Add-on: Wordpress
![Supports aarch64 Architecture][aarch64-shield] ![Supports amd64 Architecture][amd64-shield] ![Supports armhf Architecture][armhf-shield] ![Supports armv7 Architecture][armv7-shield] ![Supports i386 Architecture][i386-shield]
![Project Maintenance][maintenance-shield]

Wordpress for Homeassistant OS

![Ingress Support](../_images/wordpress/ingress.png)

## About

WORK IN PROGRESS - THIS ADDON DOES NOT WORK UNTIL NOW!

WordPress (WP or WordPress.org) is a free and open-source content management system (CMS) written in hypertext preprocessor language and paired with a MySQL or MariaDB database with supported HTTPS. Features include a plugin architecture and a template system, referred to within WordPress as "Themes". WordPress was originally created as a blog-publishing system but has evolved to support other web content types including more traditional mailing lists and Internet fora, media galleries, membership sites, learning management systems (LMS) and online stores. One of the most popular content management system solutions in use, WordPress is used by 42.8% of the top 10 million websites as of October 2021.

## Installation

[![FaserF Homeassistant Addons](https://my.home-assistant.io/badges/supervisor_add_addon_repository.svg)](https://my.home-assistant.io/redirect/supervisor_add_addon_repository/?repository_url=https%3A%2F%2Fgithub.com%2FFaserF%2Fhassio-addons)
<br />
The installation of this add-on is pretty straightforward and not different in comparison to installing any other custom Home Assistant add-on.<br />
Just click the link above or add my repo to the hassio addons repositorys: <https://github.com/FaserF/hassio-addons>

Put your website files to /share/htdocs<br />
Example File where your index.html should be: /share/htdocs/index.html <br />

If you want to integrate your website with a mariadb database. Please ensure that the MariaDB Addon is installed!

## Ingress

This addon supports Homeassistant Ingress. Until now it seems only to work if you enable SSL!

## Support

Got questions or problems?

You can [open an issue here][issue] GitHub.
Please keep in mind, that this software is only tested on armv7 running on a Raspberry Pi 4.

## Authors & contributors

The original program is from the Wordpress Project. For more informatios please visit this page: <https://wordpress.org/><br />
The Docker image has been build with alpine-php-wordpress docker image as template: <https://github.com/yobasystems/alpine-php-wordpress/tree/master/alpine-php-wordpress-amd64> <br />
The hassio addon is brought to you by [FaserF].

[maintenance-shield]: https://img.shields.io/maintenance/yes/2022.svg
[aarch64-shield]: https://img.shields.io/badge/aarch64-yes-green.svg
[amd64-shield]: https://img.shields.io/badge/amd64-yes-green.svg
[armhf-shield]: https://img.shields.io/badge/armhf-yes-green.svg
[armv7-shield]: https://img.shields.io/badge/armv7-yes-green.svg
[i386-shield]: https://img.shields.io/badge/i386-yes-green.svg
[FaserF]: https://github.com/FaserF/
[issue]: https://github.com/FaserF/hassio-addons/issues