# Home Assistant Add-on: Solumati

The Anti-Swipe Revolution - A self-hosted dating platform focused on meaningful matches.

![Supports aarch64 Architecture](https://img.shields.io/badge/aarch64-yes-green.svg)
![Supports amd64 Architecture](https://img.shields.io/badge/amd64-yes-green.svg)

## About

Solumati is a revolutionary dating platform designed to bring meaning back to matchmaking.
By hosting this add-on, you run your own instance of the Solumati platform directly on
your Home Assistant server.

## Features

- **Self-Hosted**: Your data stays on your server.
- **Integrated Database**: Comes with a pre-configured PostgreSQL database.
- **Auto-configuration**: Zero-config setup for the database connection.
- **Test Mode**: Optional mode for testing matching algorithms and features.
- **Secure**:
  - Admin password is automatically generated on first startup.
  - Database password is internally managed and randomized.
  - Process-level security fixes (hidden credentials).

## Installation

1. Add this repository to your Home Assistant Add-on Store.
1. Install the **Solumati** add-on.
1. Start the add-on.

## Configuration

**Note**: The database password is managed internally and does not need to be configured.
Applications secrets are handled automatically.

### Options

| Option      | Type    | Default | Description                                                                     |
|:------------|:--------|:--------|:--------------------------------------------------------------------------------|
| `test_mode` | boolean | `false` | Enable test mode for the application. Useful for development or debugging.      |
| `log_level` | string  | `info`  | Controls the verbosity of the logs (trace, debug, info, warning, error, fatal). |

## Usage

### First Start & Admin Password

When you start the Solumati add-on for the first time (or if the database is reset),
the application will generate a secure **Admin Password**.

1. Start the add-on.
1. Check the **Log** tab of the add-on.
1. Look for a message indicating the generated Admin credentials (e.g., "Admin user created with password: ...").
1. Copy this password immediately and store it securely.

### Accessing the Interface

Once started, click **OPEN WEB UI** to access the Solumati interface.

## Support

Got questions?
You can [open an issue here](https://github.com/FaserF/hassio-addons/issues).

## Authors & Contributors

The original Solumati program is created by **FaserF**.
Add-on maintained by [FaserF].

## License

Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International (CC BY-NC-SA 4.0)
