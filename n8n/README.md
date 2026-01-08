# Home Assistant Add-on: N8n

![Supports aarch64 Architecture][aarch64-shield] ![Supports amd64 Architecture][amd64-shield] ![Supports armv7 Architecture][armv7-shield]

N8n workflow automation tool for Home Assistant.

## About

N8n (Nodemation) is an extendable workflow automation tool. With a fair-code distribution model, n8n will always have visible source code, available to self-host, and allows you to add your own custom functions, logic, and apps. N8n's node-based approach makes it highly versatile, enabling you to connect anything to everything.

[N8n Website][n8n]

## Installation

1. Search for the "N8n" add-on in the Supervisor add-on store.
2. Install the add-on.
3. Start the "N8n" add-on.
4. Check the logs of the "N8n" add-on to see if everything went well.
5. Click "OPEN WEB UI" to access the N8n interface.

## Configuration

**Note**: This add-on supports Ingress. You can verify this by checking if the "OPEN WEB UI" button is active.

### Option: `ssl`

(Optional) Enable SSL/TLS for N8n. Default is `false`.

### Option: `certfile`

The certificate file to use for SSL. Default `fullchain.pem`.

### Option: `keyfile`

The private key file to use for SSL. Default `privkey.pem`.

### Option: `log_level`

The log level of the add-on.

## Support

Got questions?
You can open an issue here on GitHub.

[aarch64-shield]: https://img.shields.io/badge/aarch64-yes-green.svg
[amd64-shield]: https://img.shields.io/badge/amd64-yes-green.svg
[armv7-shield]: https://img.shields.io/badge/armv7-yes-green.svg
[n8n]: https://n8n.io
