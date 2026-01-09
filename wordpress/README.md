# Wordpress

![Logo](logo.png)

[![Open your Home Assistant instance and show the add-on dashboard.](https://my.home-assistant.io/badges/supervisor_addon.svg)](https://my.home-assistant.io/redirect/supervisor_addon/?addon=c1e285b7_wordpress)
[![Home Assistant Add-on](https://img.shields.io/badge/home%20assistant-addon-blue.svg)](https://www.home-assistant.io/addons/)
[![Docker Image](https://img.shields.io/badge/docker-0.1.2-blue.svg?logo=docker&style=flat-square)](https://github.com/FaserF/hassio-addons/pkgs/container/hassio-addons-wordpress)
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

---

## ⚙️ Configuration

Configure the add-on via the **Configuration** tab in the Home Assistant add-on page.

### Options

```yaml
certfile: fullchain.pem
keyfile: privkey.pem
ssl: false
wordpress_admin_email: admin@example.com
wordpress_admin_user: admin
wordpress_title: My Blog
wordpress_url: http://wordpress.local
```

### ⚠️ Important Limitations

#### URL Configuration

**Recommended**: Set `wordpress_url` to your **external/public domain** (e.g., `http://wp.fabiseitz.de` or `https://wp.fabiseitz.de`).

**Why?**
- WordPress uses the configured URL to generate asset URLs (CSS, JavaScript, images)
- If you set an internal IP address, external visitors won't be able to load assets
- The configured URL should match how most users will access your site

#### Internal vs. External Access

- **External Access** (via domain): ✅ Fully supported - all assets load correctly
- **Internal Access** (via IP address): ⚠️ **Limited support**
  - The site will load, but assets (CSS, JS, images) may not load correctly
  - This is because WordPress generates asset URLs based on the configured `wordpress_url`
  - If `wordpress_url` is set to a domain, but you access via IP, assets will try to load from the domain
  - **Workaround**: Use the external domain even when accessing from your local network, or configure your router to resolve the domain to the internal IP

#### Best Practice

1. Set `wordpress_url` to your **external/public domain** (e.g., `https://wp.fabiseitz.de`)
2. Access WordPress via the **same domain** (even from internal network)
3. Configure your router/DNS to resolve the domain to your Home Assistant IP internally
4. This ensures consistent behavior for all users

---

## 👨‍💻 Credits & License

This project is open-source and available under the MIT License.
Maintained by **FaserF**.
