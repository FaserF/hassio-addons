# Home Assistant Add-on: SAP ABAP Cloud Developer Trial

![Supports amd64 Architecture][amd64-shield]
![Project Maintenance][maintenance-shield]

SAP ABAP Cloud Developer Trial for Home Assistant OS

## ⚠️ IMPORTANT DISCLAIMERS

> **NO LICENSE PROVIDED**: This add-on does NOT include any SAP license. You must obtain your own license from SAP and agree to SAP's terms of use.

> **NO WARRANTY**: This add-on is provided "AS IS" without any warranty. The maintainer assumes NO LIABILITY for data loss, system damage, or any other issues arising from the use of this add-on.

> **FOR TESTING ONLY**: This add-on is intended solely for personal learning, skill development, and testing SAP ABAP. It is NOT intended for production use.

> **SAP LICENSE TERMS**: You must comply with all SAP licensing terms and conditions. Visit [SAP's Terms](https://www.sap.com/about/legal/disclaimer.html) for details.

## About

This add-on provides the official SAP ABAP Cloud Developer Trial environment, allowing you to run a complete SAP ABAP Platform on SAP HANA 2.0 directly from Home Assistant.

**Features:**

- SAP ABAP Platform Trial with SAP HANA database
- SAP Fiori Launchpad
- Sample applications for learning ABAP

**Use Cases:**

- Learn ABAP programming
- Improve SAP development skills
- Test SAP integrations in a sandbox environment

## Requirements

> ⚠️ **Hardware Requirements:**
>
> - **Minimum RAM:** 16 GB (32 GB recommended)
> - **Minimum CPUs:** 4
> - **Minimum Disk:** 150 GB free space
> - **Architecture:** amd64 only (x86_64)

## Installation

[![FaserF Homeassistant Addons](https://my.home-assistant.io/badges/supervisor_add_addon_repository.svg)](https://my.home-assistant.io/redirect/supervisor_add_addon_repository/?repository_url=https%3A%2F%2Fgithub.com%2FFaserF%2Fhassio-addons)

1. Add this repository to your Home Assistant add-on store
2. Install the "SAP ABAP Cloud Developer Trial" add-on
3. **READ AND ACCEPT** the SAP license terms
4. Set `agree_to_license: true` in the configuration
5. Start the add-on (initial startup takes 5-10 minutes)

## Configuration

See the [documentation](DOCS.md) for configuration details.

## Connection Details

After the add-on starts:

| Setting            | Value                  |
| ------------------ | ---------------------- |
| Application Server | Your Home Assistant IP |
| Instance Number    | 00                     |
| System ID          | A4H                    |
| Client             | 001                    |
| Default User       | DEVELOPER              |

**Web Access:** `https://<your-ip>:8443/sap/bc/ui2/flp`

## License Renewal

The SAP trial license expires after 3 months. You must renew it yourself following SAP's process.

## Support

Got questions or problems?

You can [open an issue here][issue] on GitHub.

**Note:** Issues related to SAP software itself should be directed to SAP Community forums, not this repository.

## Authors & Contributors

The SAP ABAP Trial is provided by [SAP SE](https://www.sap.com/).
This Home Assistant add-on wrapper is maintained by [FaserF].

## License

MIT License (for the add-on wrapper only)

Copyright (c) 2024-2026 FaserF

**The SAP software is subject to SAP's own license terms. This add-on does not grant any rights to SAP software.**

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED. IN NO EVENT SHALL THE AUTHORS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY ARISING FROM THE USE OF THIS SOFTWARE.

[maintenance-shield]: https://img.shields.io/maintenance/yes/2026.svg
[amd64-shield]: https://img.shields.io/badge/amd64-yes-green.svg
[FaserF]: https://github.com/FaserF/
[issue]: https://github.com/FaserF/hassio-addons/issues
