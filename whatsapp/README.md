# Home Assistant WhatsApp Addon (Playwright Backend)

This Addon provides the backend logic for the **WhatsApp Integration**. It runs a headless browser (Chromium) via Playwright to interact with WhatsApp Web.

## Features
*   **Real WhatsApp Web**: Uses the official web interface, supporting text, media (soon), and more.
*   **Persistent Session**: keeps you logged in across Home Assistant restarts.
*   **API**: Exposes a local HTTP API for the integration to control.

## Installation
1.  Add this repository to your Home Assistant Add-on Store.
2.  Install the "WhatsApp" add-on.
3.  Start the add-on.
4.  Check the logs to see it starting up.
5.  Install the "WhatsApp" integration in Home Assistant and point it to this add-on.

## Configuration
There is minimal configuration required as most is handled via the internal API.

```yaml
log_level: info
```

## Security
This add-on runs a web browser and stores your WhatsApp session cookies locally. Ensure your Home Assistant backup includes this add-on to preserve your login.
