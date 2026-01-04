# SAP ABAP Cloud Developer Trial - Configuration

> **⚠️ IMPORTANT:** This add-on is excluded from CI build/test workflows due to its size. It is only built during releases.

## Disclaimers

> **NO LICENSE PROVIDED**: This add-on does NOT include any SAP license.

> **NO WARRANTY**: Provided "AS IS" without any warranty. The maintainer assumes NO LIABILITY for data loss or other issues.

> **FOR TESTING ONLY**: Intended solely for personal learning and skill development.

## Options

### Option: `agree_to_license`

You must agree to SAP's license terms before using this add-on.

- **Type:** boolean
- **Default:** `false`
- **Required:** Yes (must be `true` to start)

By setting this to `true`, you confirm:

- You have read and accept SAP's license terms
- You understand this is for testing purposes only
- You accept all responsibility for your usage

SAP License: https://www.sap.com/about/legal/disclaimer.html

### Option: `ignore_requirements`

Bypass recommended system requirements (use at your own risk).

- **Type:** boolean
- **Default:** `false`

When `true`, allows startup with minimum requirements:

- 4 CPUs (always enforced)
- 8 GB RAM (instead of recommended 16 GB)
- 50 GB Disk (instead of recommended 150 GB)

## Network Ports

| Port  | Protocol | Description           |
| ----- | -------- | --------------------- |
| 3200  | TCP      | SAP GUI (Instance 00) |
| 3300  | TCP      | SAP Gateway           |
| 8443  | TCP      | SAP Fiori / HTTPS Web |
| 30213 | TCP      | SAP HANA Database     |
| 50000 | TCP      | ICM HTTP              |
| 50001 | TCP      | ICM HTTPS             |

## First-Time Setup

1. Start the add-on and wait 5-10 minutes
2. Access SAP Fiori: `https://<your-ip>:8443/sap/bc/ui2/flp`
3. Or connect via SAP GUI

## Default Credentials

| User      | Client | Purpose               |
| --------- | ------ | --------------------- |
| DEVELOPER | 001    | Development user      |
| SAP\*     | 000    | System administration |

## License Renewal

The trial license expires after 3 months. You must renew it yourself following SAP's process via transaction SLICENSE.
