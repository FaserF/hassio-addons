# SAP ABAP Cloud Developer Trial

![Logo](logo.png)

[![Open your Home Assistant instance and show the add-on dashboard.](https://my.home-assistant.io/badges/supervisor_addon.svg)](https://my.home-assistant.io/redirect/supervisor_addon/?addon=c1e285b7_sap-abap-cloud-dev)
[![Home Assistant Add-on](https://img.shields.io/badge/home%20assistant-addon-blue.svg)](https://www.home-assistant.io/addons/)
[![Docker Image](https://img.shields.io/badge/docker-0.0.5-blue.svg?logo=docker&style=flat-square)](https://github.com/FaserF/hassio-addons/pkgs/container/hassio-addons-sap-abap-cloud-dev)
![Project Maintenance](https://img.shields.io/badge/maintainer-FaserF-blue?style=flat-square)

> SAP ABAP Platform Trial for local ABAP development

---

> [!CAUTION]
> **Experimental / Beta Status**
>
> This add-on is still in development and/or primarily developed for personal use.
> It is not extensively tested yet, but is expected to work fundamentally.

---

## 📖 About

SAP ABAP Cloud Developer Trial for Home Assistant OS

## ⚠️ IMPORTANT DISCLAIMERS

> **NO LICENSE PROVIDED**: This add-on does NOT include any SAP license. You must obtain your own license from SAP and agree to SAP's terms of use.
>
> **NO WARRANTY**: This add-on is provided "AS IS" without any warranty. The maintainer assumes NO LIABILITY for data loss, system damage, or any other issues arising from the use of this add-on.
>
> **FOR TESTING ONLY**: This add-on is intended solely for personal learning, skill development, and testing SAP ABAP. It is NOT intended for production use.
>
> **SAP LICENSE TERMS**: You must comply with all SAP licensing terms and conditions. Visit [SAP's Terms](https://hub.docker.com/r/sapse/abap-cloud-developer-trial#licenses) for details.

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

1. Add this repository to your Home Assistant add-on store
2. Install the "SAP ABAP Cloud Developer Trial" add-on
3. **READ AND ACCEPT** the SAP license terms
4. Set `agree_to_license: true` in the configuration
5. Start the add-on (initial startup takes 5-10 minutes)

---

## ⚙️ Configuration

Configure the add-on via the **Configuration** tab in the Home Assistant add-on page.

### Options

```yaml
agree_to_license: false
ignore_requirements: false
log_level: info
```

---

## 👨‍💻 Credits & License

This project is open-source and available under the MIT License.
Maintained by **FaserF**.
