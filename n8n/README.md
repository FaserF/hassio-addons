# N8n

![Supports aarch64 Architecture][aarch64-shield] ![Supports amd64 Architecture][amd64-shield]

> Workflow automation tool. N8n extends your Home Assistant with powerful workflow automation.

---

## 📖 About

N8n (Nodemation) is an extendable workflow automation tool. With a fair-code distribution model, n8n will always have visible source code, available to self-host, and allows you to add your own custom functions, logic, and apps.

---

## 🐛 Report a Bug

If you encounter any issues with this add-on, please report them using the link below. The issue form will be pre-filled with the add-on information to help us resolve the problem faster.

**[Report a Bug](https://github.com/FaserF/hassio-addons/issues/new?template=bug_report.yml&addon_name=n8n&log_information=Please+paste+the+addon+log+output+here%3A%0A%0A)**

> [!NOTE]
> Please use the link above to report problems. This ensures that all necessary information (add-on name, version, etc.) is automatically included in your bug report.

## 💡 Feature Request

If you have an idea for a new feature or improvement, please use the link below to submit a feature request. The form will be pre-filled with the add-on information.

**[Request a Feature](https://github.com/FaserF/hassio-addons/issues/new?template=feature_request.yml&addon_name=n8n)**

> [!NOTE]
> Please use the link above to request features. This ensures that the add-on name is automatically included in your feature request.

## ⚙️ Configuration

Configure the add-on via the **Configuration** tab in the Home Assistant add-on page.

### Options

```yaml
ssl: false # Enable SSL/TLS (optional)
certfile: fullchain.pem # Certificate file path (optional)
keyfile: privkey.pem # Private key file path (optional)
log_level: info # Log level (trace, debug, info, warning, error)
```

---

## 👨‍💻 Credits & License

This project is open-source and available under the MIT License.
Maintained by **FaserF**.

[aarch64-shield]: https://img.shields.io/badge/aarch64-yes-green.svg
[amd64-shield]: https://img.shields.io/badge/amd64-yes-green.svg
