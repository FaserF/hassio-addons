# DBF (DB-Infoscreen) Documentation

Welcome to the **DBF (DB-Infoscreen)** Home Assistant App! This document provides detailed information on how to install, configure, and use this app.

## 📖 About

**DBF (DB-Infoscreen)** (formerly known as `db-fakedisplay`) is an application that displays railway departures for public transit stops in Germany, Switzerland, Austria, Luxembourg, Ireland, and parts of the USA. It can function as both an infoscreen and a web application for mobile use.

The software utilizes the IRIS (Interaktives Reise-Informations-System) backend to provide detailed information, including delay reasons, service limitations, wagon orders, and expected train types.

## 📦 Installation

To install this app, you need to add this repository to your Home Assistant Supervisor.

1.  Navigate to the **Add-on Store** in your Home Assistant instance.
2.  Search for **DBF** and click on the app card.
3.  Click the **Install** button.
4.  Once installed, you can find the app in the **Apps** section.

## 🧩 Automatic Integration Management

This add-on is equipped with a self-managed integration system. When the add-on starts:

1.  **Detection**: It scans your Home Assistant `custom_components` directory for the `db_infoscreen` integration.
2.  **Version Check**: It queries the GitHub API for the latest release of `ha-db_infoscreen` and compares it with your installed version.
3.  **Synchronization**: If the integration is missing or outdated, it automatically downloads the latest code from GitHub and installs/updates it.
4.  **Notification**: If action is taken, a persistent notification will appear in your Home Assistant dashboard, informing you that a restart is required.

This feature ensures that you always have the correct version of the integration to work with the add-on's API.

## ⚙️ Configuration

The app can be configured via the **Configuration** tab in the App page.

### Log Level

- `log_level`: Set the logging level for the app. Possible values are `debug`, `info`, `warning`, `error`, `fatal`. Default is `info`.

### Workers

- `workers`: Number of worker processes for the `hypnotoad` web server. Default is `2`.

## 📜 Legal Information

The software allows you to provide an **Imprint** and a **Privacy Policy** page. You can configure these in the configuration tab:

- `imprint_name`: Name to be displayed in the imprint.
- `imprint_address`: Address to be displayed in the imprint.
- `privacy_policy_url`: URL to an external privacy policy page.

## 🚞 Wagon Orders

The app periodically fetches `zugbildungsplan.json` to show scheduled ICE/IC types and wagon orders. This data is updated automatically once a day.

## 👨‍💻 Credits

This app is based on the [db-infoscreen](https://github.com/derf/db-fakedisplay) project by **Birte Friesel**.
Add-on maintained by **FaserF**.
Licensed under the MIT License.
