# Wordpress

<img src="https://raw.githubusercontent.com/FaserF/hassio-addons/master/wordpress/logo.png" width="100" alt="Logo" />

[![Open your Home Assistant instance and show the app dashboard.](https://my.home-assistant.io/badges/supervisor_addon.svg)](https://my.home-assistant.io/redirect/supervisor_addon/?addon=605cee21_wordpress)
[![Home Assistant App](https://img.shields.io/badge/home%20assistant-app-blue.svg)](https://www.home-assistant.io/apps/)
[![Docker Image](https://img.shields.io/badge/docker-0.4.1-blue.svg?logo=docker&style=flat-square)](https://github.com/FaserF/hassio-addons/pkgs/container/hassio-addons-wordpress)
![Project Maintenance](https://img.shields.io/badge/maintainer-FaserF-blue?style=flat-square)

> The most popular publication platform on the Web.

---

> [!CAUTION]
> **Experimental / Beta Status**
>
> This App is still in development and/or primarily developed for personal use.
> It is not extensively testet yet, but is expected to work fundamentally.

---

## 📖 About

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

Configure the app via the **Configuration** tab in the Home Assistant App page.

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

## 🐛 Report a Bug

If you encounter any issues with this add-on, please report them using the link below. The issue form will be pre-filled with the add-on information to help us resolve the problem faster.

**[Report a Bug](https://github.com/FaserF/hassio-addons/issues/new?template=bug_report.yml&version_integration=0.4.1&log_information=Please+paste+the+addon+log+output+here%3A%0A%0A)**

> [!NOTE]
> Please use the link above to report problems. This ensures that all necessary information (add-on name, version, etc.) is automatically included in your bug report.

## 💡 Feature Request

If you have an idea for a new feature or improvement, please use the link below to submit a feature request. The form will be pre-filled with the add-on information.

**[Request a Feature](https://github.com/FaserF/hassio-addons/issues/new?template=feature_request.yml&addon_name=wordpress)**

> [!NOTE]
> Please use the link above to request features. This ensures that the add-on name is automatically included in your feature request.

---

## 👨‍💻 Credits & License

This project is open-source and available under the MIT License.
Maintained by **FaserF**.
