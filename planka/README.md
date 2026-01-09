# Home Assistant Add-on: Planka

Planka is an elegant, open-source project tracking tool (Kanban board) that helps you organize your projects and tasks.

[![GitHub Release][releases-shield]][releases]
[![Project Stage][project-stage-shield]][project-stage]
[![License][license-shield]][license]
![Project Maintenance][maintenance-shield]
[![GitHub Activity][commits-shield]][commits]

![Supports aarch64 Architecture][aarch64-shield]
![Supports amd64 Architecture][amd64-shield]
![Alpine Linux][alpine-shield]

## About

![Addon Logo](logo.png)

Planka provides a modern, collaborative way to manage tasks with features like:
- Kanban boards
- Real-time updates
- Project management
- User avatars and attachments

This add-on bundles PostgreSQL to provide a complete, self-hosted solution.

## Installation

1. Search for "Planka" in the Home Assistant Add-on Store.
2. Install the add-on.
3. Start the add-on.

## Configuration

**Note**: This add-on uses Ingress by default. You can access the interface directly from the Home Assistant sidebar.

### Option: `ssl`

Enables/disables SSL on the ingress port (internal communication). Default is `true`.

### Option: `secret_key`

Secret key used for session signing. If left empty, one will be generated on startup (but sessions may be lost on restart). It is recommended to generate a strong random string and set it here.

## Support

Got questions?
You can open an issue here: [GitHub Issues][issue]

[aarch64-shield]: https://img.shields.io/badge/aarch64-yes-green.svg
[amd64-shield]: https://img.shields.io/badge/amd64-yes-green.svg
[alpine-shield]: https://img.shields.io/badge/os-Alpine-blue.svg
[commits-shield]: https://img.shields.io/github/commit-activity/y/faserf/hassio-addons.svg
[commits]: https://github.com/faserf/hassio-addons/commits/master
[license-shield]: https://img.shields.io/github/license/faserf/hassio-addons.svg
[license]: https://github.com/faserf/hassio-addons/blob/master/LICENSE.md
[maintenance-shield]: https://img.shields.io/maintenance/yes/2025.svg
[project-stage-shield]: https://img.shields.io/badge/project%20stage-experimental-yellow.svg
[project-stage]: https://github.com/faserf/hassio-addons/blob/master/ACKNOWLEDGEMENTS.md
[releases-shield]: https://img.shields.io/github/release/faserf/hassio-addons.svg
[releases]: https://github.com/faserf/hassio-addons/releases
[issue]: https://github.com/faserf/hassio-addons/issues
