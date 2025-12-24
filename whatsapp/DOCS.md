# WhatsApp Addon Documentation

## Architecture

This add-on is a "bridge". It does **not** communicate with Home Assistant directly
via the Event Bus. Instead, it acts as a server that the **WhatsApp Custom
Component** connects to.

**Flow:**
`Home Assistant` -> `WhatsApp Integration` -> `HTTP (Port 8000)` -> `This Addon`
-> `Playwright (Chrome)` -> `WhatsApp Web`

## Troubleshooting

### "Browser Context Closed"

If you see errors about the browser context, it might have crashed. The add-on is
designed to restart the browser process automatically on the next request or crash
the container to let Supervisor restart it.

### Session Lost

If you lose your session, you may need to re-scan the QR code. You can trigger
a new scan by reinstalling the integration or (in future versions) calling a
"Logout" service.

## Persistence

Your session data is stored in `/data`. This directory is persistent across add-on
updates and restarts, ensuring you don't have to scan the QR code frequently.
