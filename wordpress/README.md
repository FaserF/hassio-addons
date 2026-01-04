# Home Assistant Add-on: Wordpress

The most popular publication platform on the Web.

![Supports aarch64 Architecture][aarch64-shield] ![Supports amd64 Architecture][amd64-shield] ![Supports armv7 Architecture][armv7-shield]

## About

Wordpress is open source software you can use to create a beautiful website, blog, or app.

This add-on brings Wordpress to Home Assistant, allowing you to host your own website directly on your Home Assistant instance.

## Installation

1.  Search for the "Wordpress" add-on in the Supervisor add-on store and install it.
2.  Configure the `database` settings in the `Configuration` tab. You must have a MariaDB/MySQL database available.
3.  Start the "Wordpress" add-on.
4.  Check the logs of the "Wordpress" add-on to see if everything went well.
5.  Click the "OPEN WEB UI" button to access your Wordpress site.

## Configuration

**Note**: This add-on requires an external database (like the official MariaDB add-on).

```yaml
database_host: core-mariadb
database_name: wordpress
database_user: wordpress
database_password: password
wordpress_title: My Blog
wordpress_admin_user: admin
wordpress_admin_password: changeme
wordpress_admin_email: admin@example.com
```

### Option: `database_host`

The hostname of your database server. If using the official MariaDB add-on, use `core-mariadb`.

### Option: `database_name`

The name of the database to use.

### Option: `database_user`

The username for the database.

### Option: `database_password`

The password for the database.

## Support

Got questions?
You can reach out to us in the standard Home Assistant forums or Discord.

[aarch64-shield]: https://img.shields.io/badge/aarch64-yes-green.svg
[amd64-shield]: https://img.shields.io/badge/amd64-yes-green.svg
[armv7-shield]: https://img.shields.io/badge/armv7-yes-green.svg
