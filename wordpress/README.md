# Wordpress

![Logo](logo.png)

[![Open your Home Assistant instance and show the add-on dashboard.](https://my.home-assistant.io/badges/supervisor_addon.svg)](https://my.home-assistant.io/redirect/supervisor_addon/?addon=c1e285b7_wordpress)
[![Home Assistant Add-on](https://img.shields.io/badge/home%20assistant-addon-blue.svg)](https://www.home-assistant.io/addons/)
[![Docker Image](https://img.shields.io/badge/docker-0.0.1-blue.svg?logo=docker&style=flat-square)](https://github.com/FaserF/hassio-addons/pkgs/container/hassio-addons-wordpress)
![Project Maintenance](https://img.shields.io/badge/maintainer-FaserF-blue?style=flat-square)

> The most popular publication platform on the Web.

---

> [!CAUTION]
> **Experimental / Beta Status**
>
> This add-on is still in development and/or primarily developed for personal use.
> It is not extensively tested yet, but is expected to work fundamentally.

---

## 📖 About

The most popular publication platform on the Web.

Wordpress is open-source software you can use to create a beautiful website, blog, or app.

This add-on brings Wordpress to Home Assistant, allowing you to host your own website directly on your Home Assistant instance.

## Installation

1. Search for the "Wordpress" add-on in the Supervisor add-on store and install it.
2. Configure the `database` settings in the `Configuration` tab. You must have a MariaDB/MySQL database available.
3. Start the "Wordpress" add-on.
4. Check the logs of the "Wordpress" add-on to see if everything went well.
5. Click the "OPEN WEB UI" button to access your Wordpress site.

---

## ⚙️ Configuration

Configure the add-on via the **Configuration** tab in the Home Assistant add-on page.

### Options

```yaml
database_host: ''
database_name: wordpress
database_password: ''
database_user: wordpress
wordpress_admin_email: admin@example.com
wordpress_admin_password: changeme
wordpress_admin_user: admin
wordpress_title: My Blog
```

---

## ⚙️ Configuration

Configure the add-on via the **Configuration** tab in the Home Assistant add-on page.

#### Option: `database_host`

The hostname of your MariaDB/MySQL database.

#### Option: `database_name`

The name of the database to use.

#### Option: `database_password`

The password for the database user.

#### Option: `database_user`

The username for the database.

#### Option: `wordpress_admin_email`

The email address for the admin account.

#### Option: `wordpress_admin_password`

The password for the admin account.

#### Option: `wordpress_admin_user`

The username for the admin account.

#### Option: `wordpress_title`

The title of your Wordpress site.

---

## 👨‍💻 Credits & License

This project is open-source and available under the MIT License.
Maintained by **FaserF**.
