# Wordpress

![Logo](logo.png)

[![Open your Home Assistant instance and show the add-on dashboard.](https://my.home-assistant.io/badges/supervisor_addon.svg)](https://my.home-assistant.io/redirect/supervisor_addon/?addon=c1e285b7_wordpress)
[![Home Assistant Add-on](https://img.shields.io/badge/home%20assistant-addon-blue.svg)](https://www.home-assistant.io/addons/)
[![Docker Image](https://img.shields.io/badge/docker-0.1.4-blue.svg?logo=docker&style=flat-square)](https://github.com/FaserF/hassio-addons/pkgs/container/hassio-addons-wordpress)
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

WordPress is open-source software you can use to create a beautiful website, blog, or app.

This add-on brings Wordpress to Home Assistant, allowing you to host your own website directly
on your Home Assistant instance.

## 🌐 How to Access

The add-on exposes two ports for accessing your WordPress site:

- **HTTP**: Port `8099` => `http://homeassistant.local:8099`
- **HTTPS**: Port `8449` => `https://homeassistant.local:8449`

**Important**:

1. If you enable **SSL** (`ssl: true`), requests to the HTTP port will strictly redirect to the HTTPS port.
2. Make sure your `wordpress_url` configuration matches the protocol you intend to use (e.g., start with `https://` if using SSL).

## 🔐 First Run & Login

### Initial Credentials

On the **very first startup**, the add-on will install WordPress and automatically generate a secure **Admin Password**.

1. Start the add-on.
2. Check the **Log** tab of the add-on immediately.
3. Look for a message box containing **"Wordpress Admin Password"**.
4. **Copy and save this password!** It will only be shown once.

The default **Username** is `admin` (unless changed in configuration).

### Database & Config

- A `wp-config.php` file is automatically generated and maintained by the add-on.
- The database connection is handled automatically.

---

## ⚙️ Configuration

Configure the add-on via the **Configuration** tab in the Home Assistant add-on page.

### Options

```yaml
certfile: fullchain.pem
keyfile: privkey.pem
log_level: info
ssl: false
wordpress_admin_email: admin@example.com
wordpress_admin_user: admin
wordpress_title: My Blog
wordpress_url: http://wordpress.local
```

#### Option: `ssl`
Enables Nginx SSL support. Requires valid certificate files.

#### Option: `certfile` & `keyfile`
The names of your certificate and key files located in the `/ssl/` directory of your Home Assistant.

#### Option: `log_level`
The level of logging to output.
-   Values: `trace`, `debug`, `info`, `notice`, `warning`, `error`, `fatal`
-   Default: `info`
-   This improves troubleshooting when set to `debug` or `trace`.

#### Option: `wordpress_url`
The public URL of your WordPress site.
-   **Must** start with `http://` or `https://`.
-   This setting controls how WordPress generates links and how the add-on handles redirects.

---

## 👨‍💻 Credits & License

This project is open-source and available under the MIT License.
Maintained by **FaserF**.
