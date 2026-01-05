# pterodactyl Wings Gameserver

![Logo](logo.png)

[![Open your Home Assistant instance and show the add-on dashboard.](https://my.home-assistant.io/badges/supervisor_addon.svg)](https://my.home-assistant.io/redirect/supervisor_addon/?addon=c1e285b7_pterodactyl-wings)
[![Home Assistant Add-on](https://img.shields.io/badge/home%20assistant-addon-blue.svg)](https://www.home-assistant.io/addons/)
[![Docker Image](https://img.shields.io/badge/docker-2.0.0-blue.svg?logo=docker&style=flat-square)](https://github.com/FaserF/hassio-addons/pkgs/container/hassio-addons-pterodactyl_wings)
![Project Maintenance](https://img.shields.io/badge/maintainer-FaserF-blue?style=flat-square)

> Open Source Gameserver

---

## 📖 About

If you encounter any issues with this add-on, please report them using the link below. The issue form will be pre-filled with the add-on information to help us resolve the problem faster.

If you have an idea for a new feature or improvement, please use the link below to submit a feature request. The form will be pre-filled with the add-on information.

## 🐛 Report a Bug

If you encounter any issues with this add-on, please report them using the link below. The issue form will be pre-filled with the add-on information to help us resolve the problem faster.

**[Report a Bug](https://github.com/FaserF/hassio-addons/issues/new?template=bug_report.yml&version_integration=2.0.0&log_information=Please+paste+the+addon+log+output+here%3A%0A%0A)**

> [!NOTE]
> Please use the link above to report problems. This ensures that all necessary information (add-on name, version, etc.) is automatically included in your bug report.

## 💡 Feature Request

If you have an idea for a new feature or improvement, please use the link below to submit a feature request. The form will be pre-filled with the add-on information.

**[Request a Feature](https://github.com/FaserF/hassio-addons/issues/new?template=feature_request.yml&addon_name=pterodactyl-wings)**

> [!NOTE]
> Please use the link above to request features. This ensures that the add-on name is automatically included in your feature request.

This project is open-source and available under the MIT License.
Maintained by **FaserF**.

---

## ⚙️ Configuration

Configure the add-on via the **Configuration** tab in the Home Assistant add-on page.

### Options

```yaml
config_file: /share/pterodactyl/config.yml
```

### Initial Setup

1.  **Start the Add-on**: If the configuration file defined in `config_file` does not exist, the add-on will create a default one for you at that location.
2.  **Access Pterodactyl Panel**: Go to your Pterodactyl Panel (e.g., using the `pterodactyl-panel` add-on).
3.  **Create Node**: Navigate to the Admin View -> Nodes and create a new node.
4.  **Get Configuration**: Click on the 'Configuration' tab of your newly created node.
5.  **Update Config File**: Copy the YAML Configuration block shown in the Panel and paste it into your `config.yml` file (default: `/share/pterodactyl/config.yml`).
    *   **Note**: Ensure the paths in the config file match your Home Assistant environment. The default template already sets `data: /share/pterodactyl/data` and SSL paths to `/ssl/...`.
6.  **Restart Wings**: Restart this add-on to apply the configuration.

---

## 👨‍💻 Credits & License

This project is open-source and available under the MIT License.
Maintained by **FaserF**.
