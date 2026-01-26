# WhatsApp

![Logo](logo.png)

[![Open your Home Assistant instance and show the add-on dashboard.](https://my.home-assistant.io/badges/supervisor_addon.svg)](https://my.home-assistant.io/redirect/supervisor_addon/?addon=c1e285b7_whatsapp)
[![Home Assistant Add-on](https://img.shields.io/badge/home%20assistant-addon-blue.svg)](https://www.home-assistant.io/addons/)
[![Docker Image](https://img.shields.io/badge/docker-0.5.3-blue.svg?logo=docker&style=flat-square)](https://github.com/FaserF/hassio-addons/pkgs/container/hassio-addons-whatsapp)
![Project Maintenance](https://img.shields.io/badge/maintainer-FaserF-blue?style=flat-square)

> Home Assistant WhatsApp Backend (Baileys/Node.js)

---

> [!CAUTION]
> **Legal Disclaimer / Haftungsausschluss**
>
> Using this add-on may violate WhatsApp's **[Terms of Service](https://www.whatsapp.com/legal/terms-of-service/)**. WhatsApp explicitly prohibits unauthorized automated or bulk messaging.
>
> **The developers of this project assume no liability for any banned or blocked accounts.** Use at your own risk. For more information, please read the official statement on **[Unauthorized Messaging](https://faq.whatsapp.com/583411470476406/)**.

---

## 📖 About

If you encounter any issues with this add-on, please report them using the link below. The issue form will be pre-filled with the add-on information to help us resolve the problem faster.

If you have an idea for a new feature or improvement, please use the link below to submit a feature request. The form will be pre-filled with the add-on information.

## 🐛 Report a Bug

If you encounter any issues with this add-on, please report them using the link below. The issue form will be pre-filled with the add-on information to help us resolve the problem faster.

**[Report a Bug](https://github.com/FaserF/hassio-addons/issues/new?template=bug_report.yml&version_integration=0.3.0&log_information=Please+paste+the+addon+log+output+here%3A%0A%0A)**

> [!NOTE]
> Please use the link above to report problems. This ensures that all necessary information (add-on name, version, etc.) is automatically included in your bug report.

## 💡 Feature Request

If you have an idea for a new feature or improvement, please use the link below to submit a feature request. The form will be pre-filled with the add-on information.

**[Request a Feature](https://github.com/FaserF/hassio-addons/issues/new?template=feature_request.yml&addon_name=whatsapp)**

> [!NOTE]
> Please use the link above to request features. This ensures that the add-on name is automatically included in your feature request.

This project is open-source and available under the MIT License.
Maintained by **FaserF**.

## 🛠️ Usage & Integration

To actually send messages and automate WhatsApp, you need the **WhatsApp Custom Integration** for Home Assistant.

- **[Official Documentation & Examples](https://faserf.github.io/ha-whatsapp/)**: Comprehensive guide on how to use the `notify` service, send buttons, polls, images, and creating bot automations.

---

## ⚙️ Configuration

Configure the add-on via the **Configuration** tab in the Home Assistant add-on page.

### Options

```yaml
keep_alive_interval: 30000
log_level: info
mask_sensitive_data: false
reset_session: false
send_message_timeout: 25000
```

---

## 👨‍💻 Credits & License

This project is open-source and available under the MIT License.
Maintained by **FaserF**.
