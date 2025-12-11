# Home Assistant Add-on: Solumati

The Anti-Swipe Revolution - A self-hosted dating platform focused on meaningful matches.

![Supports aarch64 Architecture](https://img.shields.io/badge/aarch64-yes-green.svg)
![Supports amd64 Architecture](https://img.shields.io/badge/amd64-yes-green.svg)

## About

Solumati is a revolutionary dating platform designed to bring meaning back to matchmaking.
By hosting this add-on, you run your own instance of the Solumati platform directly on
your Home Assistant server.

## Features

- **Home Assistant Ingress**: Secure access through the HA sidebar (no port forwarding needed)
- **Self-Hosted**: Your data stays on your server
- **Integrated Database**: Comes with a pre-configured PostgreSQL database
- **Auto-configuration**: Zero-config setup for the database connection
- **Test Mode**: Optional mode for testing with dummy user data
- **OAuth/SMTP Support**: Configure via Admin Panel after first login
- **Secure**:
  - Admin password is automatically generated on first startup
  - Database password is internally managed and randomized
  - Ingress provides secure authenticated access

## Installation

1. Add this repository to your Home Assistant Add-on Store.
2. Install the **Solumati** add-on.
3. Configure the options (see below).
4. Start the add-on.
5. Click "OPEN WEB UI" or access via the sidebar.

## Configuration

All options are configured via the Home Assistant UI. The database is automatically managed.

### Options

| Option | Type | Default | Description |
|:-------|:-----|:--------|:------------|
| `log_level` | select | `info` | Log verbosity: trace, debug, info, warning, error, fatal |
| `test_mode` | boolean | `false` | Enable test mode with dummy user data for testing |
| `app_base_url` | string | (auto) | Base URL for the app (for emails/links). Auto-detected from Ingress if empty |

> **Note**: OAuth providers and SMTP settings are configured in the **Admin Panel** after first login, not here.

### ⚠️ Factory Reset (Danger Zone)

| Option | Type | Default | Description |
|:-------|:-----|:--------|:------------|
| `factory_reset` | boolean | `false` | **DANGEROUS!** Permanently deletes ALL data on next restart |

> **CAUTION**: Enabling `factory_reset` will **permanently delete**:
> - All user accounts and profiles
> - All messages and conversations
> - All uploaded images
> - All settings and configurations
>
> This cannot be undone! After the reset, you must disable this option manually, otherwise your data will be wiped again on each restart.

## Usage

### First Start & Admin Password

When you start the add-on for the first time:

1. Start the add-on
2. Check the **Log** tab
3. Look for: `Admin user created with password: ...`
4. Copy this password immediately and store it securely!

### Accessing the Interface

- **Recommended**: Click the Solumati icon in the Home Assistant sidebar (Ingress)
- **Alternative**: Click "OPEN WEB UI" or access `http://homeassistant.local:8099`

### Test Mode

Enable `test_mode` to generate dummy users for testing the matching algorithm.
Disable it in production to prevent fake profiles.

## Support

Got questions? [Open an issue here](https://github.com/FaserF/hassio-addons/issues).

## Authors & Contributors

The [original Solumati software](https://github.com/FaserF/Solumati) is created by **FaserF**.

## License

GNU AFFERO GENERAL PUBLIC LICENSE (AGPL)
