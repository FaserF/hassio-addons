# Wordpress

> [!CAUTION]
> **EDGE/DEVELOPMENT BUILD**
>
> You are viewing the `edge` branch. This version is built locally from source
> and may contain bugs or incomplete features. For stable releases, switch to
> the `master` branch or use the stable repository URL.



<img src="https://raw.githubusercontent.com/FaserF/hassio-addons/master/wordpress/logo.png" width="100" />

[![Open your Home Assistant instance and show the add-on dashboard.](https://my.home-assistant.io/badges/supervisor_addon.svg)](https://my.home-assistant.io/redirect/supervisor_addon/?addon=c1e285b7_wordpress)
[![Home Assistant App](https://img.shields.io/badge/home%20assistant-addon-blue.svg)](https://www.home-assistant.io/addons/)
[![Docker Image](https://img.shields.io/badge/docker-0.3.0-blue.svg?logo=docker&style=flat-square)](https://github.com/FaserF/hassio-addons/pkgs/container/hassio-addons-wordpress)
![Project Maintenance](https://img.shields.io/badge/maintainer-FaserF-blue?style=flat-square)

> The most popular publication platform on the Web.

---

## ❤️ Support This Project

> I maintain all these add-ons in my **free time alongside a regular job**. Test devices cost money, and every donation helps me stay independent and invest more time into open-source work.
>
> Donations are completely voluntary — but the more support I receive, the less I depend on other income and the more time I can dedicate to these projects.

<div align="center">

[![GitHub Sponsors](https://img.shields.io/badge/Sponsor%20on-GitHub-%23EA4AAA?style=for-the-badge&logo=github-sponsors&logoColor=white)](https://github.com/sponsors/FaserF)&nbsp;&nbsp;
[![PayPal](https://img.shields.io/badge/Donate%20via-PayPal-%2300457C?style=for-the-badge&logo=paypal&logoColor=white)](https://paypal.me/FaserF)

</div>

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

This app brings Wordpress to Home Assistant, allowing you to host your own website directly
on your Home Assistant instance.

## 🌐 How to Access

The app exposes two ports for accessing your WordPress site:

- **HTTP**: Port `8099` => `http://homeassistant.local:8099`
- **HTTPS**: Port `8449` => `https://homeassistant.local:8449`

**Important**:

1. If you enable **SSL** (`ssl: true`), requests to the HTTP port will strictly redirect to the HTTPS port.
2. Make sure your `wordpress_url` configuration matches the protocol you intend to use (e.g., start with `https://` if using SSL).

## 🔐 First Run & Login

### Initial Credentials

On the **very first startup**, the app will install WordPress and automatically generate a secure **Admin Password**.

1. Start the app.
2. Check the **Log** tab of the app immediately.
3. Look for a message box containing **"Wordpress Admin Password"**.
4. **Copy and save this password!** It will only be shown once.

The default **Username** is `admin` (unless changed in configuration).

### Database & Config

- A `wp-config.php` file is automatically generated and maintained by the app.
- The database connection is handled automatically.

---

## ⚙️ Configuration

Configure the add-on via the **Configuration** tab in the Home Assistant App page.

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

---

## 👨‍💻 Credits & License

This project is open-source and available under the MIT License.
Maintained by **FaserF**.
