# Wiki.JS (Version 3 - Alpha)

<img src="https://raw.githubusercontent.com/FaserF/hassio-addons/master/wiki.js3/logo.png" width="100" />

[![Open your Home Assistant instance and show the add-on dashboard.](https://my.home-assistant.io/badges/supervisor_addon.svg)](https://my.home-assistant.io/redirect/supervisor_addon/?addon=c1e285b7_wiki.js3)
[![Home Assistant App](https://img.shields.io/badge/home%20assistant-addon-blue.svg)](https://www.home-assistant.io/addons/)
[![Docker Image](https://img.shields.io/badge/docker-0.6.0-blue.svg?logo=docker&style=flat-square)](https://github.com/FaserF/hassio-addons/pkgs/container/hassio-addons-wiki)
![Project Maintenance](https://img.shields.io/badge/maintainer-FaserF-blue?style=flat-square)

> The most powerful and extensible open source Wiki software (Version 3 - Alpha)

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

## 🐛 Report a Bug

If you encounter any issues with this app, please report them using the link below. The issue form will be pre-filled with the app information to help us resolve the problem faster.

**[Report a Bug](https://github.com/FaserF/hassio-addons/issues/new?template=bug_report.yml&version_integration=0.2.0&log_information=Please+paste+the+App+log+output+here%3A%0A%0A)**

> [!NOTE]
> Please use the link above to report problems. This ensures that all necessary information (app name, version, etc.) is automatically included in your bug report.

## 💡 Feature Request

If you have an idea for a new feature or improvement, please use the link below to submit a feature request. The form will be pre-filled with the app information.

**[Request a Feature](https://github.com/FaserF/hassio-addons/issues/new?template=feature_request.yml&App_name=wiki.js3)**

> [!NOTE]
> Please use the link above to request features. This ensures that the app name is automatically included in your feature request.

This project is open-source and available under the MIT License.
Maintained by **FaserF**.

## 🏁 First Startup

On the first startup, you will be prompted with an administration setup wizard. The wizard will guide you through the initial configuration of your wiki connection and the creation of your administrator account.

Please create your own **Administrator Account** (Email / Password) during this process.

### Default Database Credentials

The app comes pre-configured with a local PostgreSQL database. The default password for the `wiki` database user is:

- **Password**: `wikijs` (This is the database password, NOT your admin login)

---

## ⚙️ Configuration

Configure the add-on via the **Configuration** tab in the Home Assistant App page.

### Options

```yaml
certfile: fullchain.pem
db_password: wikijs
keyfile: privkey.pem
log_level: info
reset_database: false
reset_database_confirm: false
ssl: true
```

---

## 👨‍💻 Credits & License

This project is open-source and available under the MIT License.
Maintained by **FaserF**.
