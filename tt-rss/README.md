# Home Assistant Add-on: Tiny Tiny RSS

[![GitHub Release][releases-shield]][releases]
[![Project Stage][project-stage-shield]][project-stage]
[![License][license-shield]][license]
![Project Maintenance][maintenance-shield]
[![GitHub Activity][commits-shield]][commits]

![Supports aarch64 Architecture][aarch64-shield]
![Supports amd64 Architecture][amd64-shield]

Tiny Tiny RSS is a free and open-source web-based news feed (RSS/Atom) reader and aggregator.

## About

![Addon Logo](logo.png)

This add-on provides a self-hosted instance of Tiny Tiny RSS (TT-RSS). It is designed to be lightweight and fast, using Alpine Linux, Nginx, and PHP 8.3.

**Note:** This add-on requires a database. You should configure it to connect to a MariaDB or PostgreSQL instance (either another add-on or external).

## Installation

1.  Search for "Tiny Tiny RSS" in the Home Assistant Add-on Store.
2.  Install the add-on.
3.  Configure the database connection settings (see Configuration below).
4.  Start the add-on.

## Configuration

**Note**: Configuration logic is currently minimal. You may need to manually edit `config.php` if advanced customization is required, or rely on environment variables passed via `s6-overlay` if verified supported by the upstream docker logic (though this is a custom build, so we need to ensure config mapping).

*Ideally, future versions will expose all key TT-RSS config options here.*

## Support

If you run into issues, please report them on the GitHub repository issue tracker.

## License

MIT License

[aarch64-shield]: https://img.shields.io/badge/aarch64-yes-green.svg
[amd64-shield]: https://img.shields.io/badge/amd64-yes-green.svg
[commits-shield]: https://img.shields.io/github/commit-activity/y/faserf/hassio-addons.svg
[commits]: https://github.com/faserf/hassio-addons/commits/master
[license-shield]: https://img.shields.io/github/license/faserf/hassio-addons.svg
[license]: https://github.com/faserf/hassio-addons/blob/master/LICENSE.md
[maintenance-shield]: https://img.shields.io/maintenance/yes/2025.svg
[project-stage-shield]: https://img.shields.io/badge/project%20stage-experimental-yellow.svg
[project-stage]: https://github.com/faserf/hassio-addons/blob/master/ACKNOWLEDGEMENTS.md
[releases-shield]: https://img.shields.io/github/release/faserf/hassio-addons.svg
[releases]: https://github.com/faserf/hassio-addons/releases
