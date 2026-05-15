# Webserver App Integration

[![hacs](https://img.shields.io/badge/HACS-custom-orange.svg?style=flat-square)](https://hacs.xyz)
[![Add to Home Assistant](https://my.home-assistant.io/badges/hacs_repository.svg)](https://my.home-assistant.io/redirect/hacs_repository/?owner=FaserF&repository=hassio-addons&category=integration&branch=edge)
[![Open your Home Assistant instance and start setting up a new integration.](https://my.home-assistant.io/badges/config_flow_start.svg)](https://my.home-assistant.io/redirect/config_flow_start/?domain=webserver_app)

A native, lightweight Home Assistant integration designed to seamlessly monitor and manage Apache2 and Nginx webserver add-ons from the FaserF repository. Automatically traces operational metrics, monitors SSL certificate expiration, parses error logs, and facilitates live add-on reloads directly from your dashboard.

## ✨ Features

- **Automated Supervisor Discovery**:
  - Dynamically detects supported local add-ons via the Home Assistant Supervisor internal API.
  - Zero manual YAML configuration needed.
- **Comprehensive Telemetry Sensors**:
  - **Status**: Live operational tracker (`started`, `stopped`) with instant update notifications.
  - **Version**: Tracks currently installed add-on version vs. newly available releases.
  - **Performance Stats**: Real-time extraction of active network connections, server load, total accesses, and handled HTTP requests.
  - **Log Diagnostics**: Proactively scans and aggregates critical add-on logs for `ERROR` and `WARNING` patterns.
- **SSL Lifecycle Management**:
  - Automatically loads and analyzes active local certificates (e.g. via `/ssl/`).
  - Dedicated sensors expose absolute **SSL Expiration Date** alongside a countdown of **Remaining Valid Days**.
- **Control & Recovery**:
  - **Reload Button**: Native button entity allowing immediate restarts of add-on containers straight from the entity detail view.
- **Advanced Observability**:
  - Fully supports downloading JSON state maps directly inside Home Assistant via native **Diagnostics** integration.

## 📦 Supported Add-ons

| Add-on Variant                                                                                                  | Supported Internal Slugs                                  |
| :-------------------------------------------------------------------------------------------------------------- | :-------------------------------------------------------- |
| **[Apache2](https://github.com/FaserF/hassio-addons/tree/master/apache2)**                                      | `apache2`, `apache2-edge`                                 |
| **[Apache2 Minimal](https://github.com/FaserF/hassio-addons/tree/master/apache2-minimal)**                      | `apache2-minimal`, `apache2-minimal-edge`                 |
| **[Apache2 Minimal with MariaDB](https://github.com/FaserF/hassio-addons/tree/master/apache2-minimal-mariadb)** | `apache2-minimal-mariadb`, `apache2-minimal-mariadb-edge` |
| **[Nginx](https://github.com/FaserF/hassio-addons/tree/master/nginx)**                                          | `nginx`, `nginx-edge`                                     |

## 🚀 Installation & Setup

### HACS Installation

1. Open HACS inside Home Assistant.
2. Click the three dots in the top right corner and select **Custom repositories**.
3. Add `FaserF/hassio-addons` as an **Integration** repository.
4. Search for **Webserver App** and click Download.
5. Restart Home Assistant.

### Quick Setup

Click the button below to start configuring the integration instantly:

[![Open your Home Assistant instance and start setting up a new integration.](https://my.home-assistant.io/badges/config_flow_start.svg)](https://my.home-assistant.io/redirect/config_flow_start/?domain=webserver_app)

Alternatively, go to **Settings > Devices & Services**, click **Add Integration**, search for **Webserver App**, and select your add-on variant.
