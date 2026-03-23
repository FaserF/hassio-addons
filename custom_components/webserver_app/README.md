# Webserver App Integration

[![Add to Home Assistant](https://my.home-assistant.io/badges/hacs_repository.svg)](https://my.home-assistant.io/redirect/hacs_repository/?owner=FaserF&repository=hassio-addons&category=integration)

This integration provides monitoring for Apache2 and Nginx addons from the FaserF/hassio-addons repository.

## Features

- **Discovery**: Automatically detects installed Apache2 and Nginx addons.
- **Sensors**:
  - **Status**: Monitor if the addon is running, stopped, or has an update available.
  - **Version**: Tracks the currently installed version of the addon.
- **Device Support**: Each addon instance is represented as a device in Home Assistant.

## Supported Addons

- Apache2 (`apache2`, `apache2-edge`)
- Apache2 Minimal (`apache2-minimal`, `apache2-minimal-edge`)
- Apache2 Minimal with MariaDB (`apache2-minimal-mariadb`, `apache2-minimal-mariadb-edge`)
- Nginx (`nginx`, `nginx-edge`)

## Installation

This integration is automatically installed and updated by the supported addons upon startup. 
Manual installation can be done by copying the `webserver_app` folder to your `custom_components` directory.

## Configuration

1. Go to **Settings > Devices & Services**.
2. Click **Add Integration**.
3. Search for **Webserver App**.
4. Select the addon slug and port.
