# WhatsApp App API Documentation

This App exposes a REST API that acts as a bridge between Home Assistant (via the [ha-whatsapp integration](https://github.com/FaserF/ha-whatsapp)) and the WhatsApp network using `Baileys`.

- **[Official Documentation & Examples](https://faserf.github.io/ha-whatsapp/)**: Comprehensive guide on how to use the `notify` service, send buttons, polls, images, and creating bot automations.

> [!WARNING]
> **Interactive Messages (Buttons & Lists)**: These features are increasingly restricted by Meta for unofficial APIs. They may not appear on all devices (especially iOS). If they fail for you, consider using standard text messages or **Polls**, which are much more reliable.

## Authentication

All API requests (except `/health`) **MUST** include the `X-Auth-Token` header.

- The token is automatically generated on first run.
- You can view and copy the token from the App Dashboard (Web UI).

> [!WARNING]
> **Reliability Note**: Interactive messages (Buttons/Lists) are currently unstable due to WhatsApp (Meta) restrictions on unofficial libraries. They may not show up on all devices. Polls are recommended as a more stable alternative.

## Endpoints

### 1. Connection Management

#### `POST /session/start`

Initiates a new session. If not connected, it starts the QR code generation process.

**Response:**

```json
{ "status": "starting", "message": "Session init started" }
```

#### `GET /status`

Returns connection status and library version.

**Response:**

```json
{
  "connected": true,
  "version": "6.5.0"
}
```

#### `GET /qr`

Returns the current QR code as a Data URL image string if scanning is required.

**Response:**

```json
{
  "status": "scanning",
  "qr": "data:image/png;base64,..."
}
```

#### `DELETE /session`

Logs out and deletes the current session data. Useful for resetting connection errors.

**Response:**

```json
{ "status": "success", "message": "Session deleted and logged out" }
```

### ⚙️ Configuration

```yaml
log_level: info
mark_online: false
mask_sensitive_data: false
media_folder: ''
reset_session: false
send_message_timeout: 25000
ui_auth_enabled: false
ui_auth_password: ''
webhook_enabled: false
webhook_token: ''
webhook_url: ''
admin_numbers: '491701234567, 491707654321'
```

### 🗝️ Admin Security

To use `ha-app-*` control commands, add your phone number to `admin_numbers`. Numbers are automatically normalized (handling `+`, `0`, and spaces). Unauthorized users receive a one-time "Permission Denied" warning.

### 2. Messaging

#### `POST /send_message`

Sends a basic text message.

**Payload:**

```json
{
  "number": "1234567890",
  "message": "Hello World"
}
```

#### `POST /send_image`

Sends an image from a public URL.

**Payload:**

```json
{
  "number": "1234567890",
  "url": "https://example.com/image.png",
  "caption": "Check this out!"
}
```

#### `POST /send_poll`

Sends a poll.

**Payload:**

```json
{
  "number": "1234567890",
  "question": "Pizza or Burger?",
  "options": ["Pizza", "Burger", "Both"]
}
```

#### `POST /send_location`

Sends a location pin.

**Payload:**

```json
{
  "number": "1234567890",
  "latitude": 51.5074,
  "longitude": -0.1278,
  "title": "London",
  "description": "Capital of England"
}
```

#### `POST /send_buttons`

Sends a message with interactive buttons.
_Note: Button support varies by device and WhatsApp version._

**Payload:**

```json
{
  "number": "1234567890",
  "message": "Choose an option",
  "footer": "Select one",
  "buttons": [
    {
      "buttonId": "id1",
      "displayText": "Button 1"
    },
    {
      "buttonId": "id2",
      "displayText": "Button 2"
    }
  ]
}
```

#### `POST /send_document`

Sends a document (PDF, Zip, Doc, etc.).

**Payload:**

```json
{
  "number": "1234567890",
  "url": "https://example.com/file.pdf",
  "fileName": "document.pdf",
  "caption": "Here is the document you requested"
}
```

#### `POST /send_video`

Sends a video file.

**Payload:**

```json
{
  "number": "1234567890",
  "url": "https://example.com/video.mp4",
  "caption": "Watch this!"
}
```

#### `POST /send_audio`

Sends an audio file or voice note.

**Payload:**

```json
{
  "number": "1234567890",
  "url": "https://example.com/audio.mp3",
  "ptt": true
}
```

**Note:** `ptt: true` sends it as a voice note (waveform), `false` sends it as a normal audio file.

#### `POST /revoke_message`

Revokes (deletes) a sent message for everyone.

**Payload:**

```json
{
  "number": "1234567890",
  "message_id": "BAE5CCF5A..."
}
```

#### `POST /edit_message`

Edits the text of a sent message.

**Payload:**

```json
{
  "number": "1234567890",
  "message_id": "BAE5CCF5A...",
  "new_content": "Corrected text"
}
```

#### `POST /send_reaction`

Reacts to a specific message.

**Payload:**

```json
{
  "number": "1234567890",
  "reaction": "👍",
  "messageId": "MESSAGE_ID_HERE"
}
```

### 3. Interaction

#### `POST /set_presence`

Sets the chat presence/status.

**Payload:**

```json
{
  "number": "1234567890",
  "presence": "composing"
}
```

**Values:** `composing`, `recording`, `paused`, `available`

#### `POST /settings/webhook`

Update webhook configuration dynamically (persisted to disk).

**Payload:**

```json
{
  "url": "http://homeassistant:8123/api/webhook/...",
  "enabled": true,
  "token": "optional-secret-token"
}
```

#### `POST /send_list`

Sends an interactive List Message (Action Menu).

**Payload:**

```json
{
  "number": "1234567890",
  "title": "Menu Title",
  "text": "Menu Body Text",
  "button_text": "Click View",
  "sections": [
    {
      "title": "Section 1",
      "rows": [
        {
          "title": "Row Title",
          "description": "Row Description",
          "id": "rowId1"
        },
        {
          "title": "Option 2",
          "id": "opt2",
          "description": "Subtext"
        }
      ]
    }
  ]
}
```

#### `POST /send_contact`

Sends a VCard contact.

**Payload:**

```json
{
  "number": "1234567890",
  "contact_name": "Home Assistant",
  "contact_number": "1234567890"
}
```

### 4. Native Commands

The App supports several commands sent via WhatsApp messages directly to the bot.

#### Public Commands

Available to anyone:

- **`ha-app-ping`**: Returns "Pong! 🏓" (useful for checking connection).
- **`ha-app-getid`**: Returns the current Chat ID (useful for finding Group IDs).
- **`ha-app-status`**: Comprehensive system status report. (Anonymized and rate-limited to 1/min for non-admins).

#### Admin Commands (Protected)

Requires the sender's number to be in the `admin_numbers` whitelist.

- **`ha-app-help`**: Lists all available commands and examples.
- **`ha-app-diagnose`**: Run full message type diagnostic (Text, Reactions, Buttons, Lists, Location).
- **`ha-app-logs`**: Retrieves the latest 10 connection events.
- **`ha-app-restart`**: Gracefully restarts the WhatsApp connection.
- **`ha-app-stats`**: View message statistics.

> [!IMPORTANT]
> Non-admin users attempting to use protected `ha-app-*` commands will receive a single "Permission Denied" warning.

### 5. Events & Logs

#### `GET /events`

Polling endpoint for the integration. Returns a list of received messages and clears the queue.

**Response:**

```json
[
  {
    "key": { "remoteJid": "...", "id": "..." },
    "message": { "conversation": "Hello" }
  }
]
```

#### `GET /logs`

Returns the recent internal connection logs (used by dashboard).

**Response:**

```json
[{ "timestamp": "10:00:00 AM", "msg": "Connected", "type": "success" }]
```

#### `GET /health`

Healthcheck endpoint for Docker/Supervisor. No auth required.

**Response:**

```json
{ "status": "ok", "service": "whatsapp-addon" }
```
