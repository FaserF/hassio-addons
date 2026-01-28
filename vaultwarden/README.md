# Home Assistant Community Add-on: Vaultwarden (Bitwarden) (Custom)

![Logo](logo.png)

[![Open your Home Assistant instance and show the add-on dashboard.](https://my.home-assistant.io/badges/supervisor_addon.svg)](https://my.home-assistant.io/redirect/supervisor_addon/?addon=vaultwarden)
[![Home Assistant Add-on](https://img.shields.io/badge/home%20assistant-addon-blue.svg)](https://www.home-assistant.io/addons/)
![Project Maintenance](https://img.shields.io/badge/maintainer-FaserF-blue?style=flat-square)

> Open source password management solution (Custom Build based on Alpine Linux).

---

## 📖 About

This add-on allows you to host your own **Vaultwarden** server (formerly known as Bitwarden_RS) directly on Home Assistant. It is a lightweight implementation of the Bitwarden server API written in Rust and compatible with official Bitwarden clients.

**Why this Custom Version?**
The official add-on uses a Debian base and is updated manually. This custom version updates automatically via Renovate and runs on **Alpine Linux**, making it smaller, faster, and more efficient.

## ⚖️ Comparison: Custom vs Official

| Feature | Custom Add-on | Official Add-on |
| :--- | :--- | :--- |
| **Base Image** | **Alpine Linux** | Debian |
| **Updates** | **Automated (Renovate)** | Manual |
| **Release Speed** | **Fast** (Automated) | Slower |
| **Size** | **Smaller** (Alpine) | Larger (Debian) |
| **Database Libs** | MariaDB, PostgreSQL, SQLite (apk) | MariaDB, PostgreSQL, SQLite (apt) |
| **Web Server** | Nginx (Alpine) | Nginx (Debian) |

---

## 🐛 Report a Bug

If you encounter any issues with this add-on, please report them using the link below. The issue form will be pre-filled with the add-on information to help us resolve the problem faster.

**[Report a Bug](https://github.com/FaserF/hassio-addons/issues/new?template=bug_report.yml&addon_name=vaultwarden&log_information=Please+paste+the+addon+log+output+here%3A%0A%0A)**

---

## 💡 Feature Request

If you have an idea for a new feature or improvement, please use the link below to submit a feature request.

**[Request a Feature](https://github.com/FaserF/hassio-addons/issues/new?template=feature_request.yml&addon_name=vaultwarden)**

---

## ⚙️ Configuration

Configure the add-on via the **Configuration** tab in the Home Assistant add-on page.

### Example Options

```yaml
log_level: info
ssl: true
certfile: fullchain.pem
keyfile: privkey.pem
request_size_limit: 10485760
domain: "vaultwarden.local"
```

Please read the **[Full Documentation](DOCS.md)** for detailed installation and configuration instructions.

---

## 👨‍💻 Credits & License

The original setup of this repository is by [Franck Nijhof][frenck].
This project is open-source and available under the MIT License.
Maintained by **FaserF**.

[frenck]: https://github.com/frenck
