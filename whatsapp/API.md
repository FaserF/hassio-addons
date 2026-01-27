# WhatsApp Addon API Documentation

This addon exposes a REST API that acts as a bridge between Home Assistant (via the [ha-whatsapp integration](https://github.com/FaserF/ha-whatsapp)) and the WhatsApp network using `Baileys`.

## Authentication

All API requests (except `/health`) **MUST** include the `X-Auth-Token` header.

- The token is automatically generated on first run.
- You can view and copy the token from the Addon Dashboard (Web UI).

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
    { "buttonId": "id1", "buttonText": { "displayText": "Button 1" }, "type": 1 },
    { "buttonId": "id2", "buttonText": { "displayText": "Button 2" }, "type": 1 }
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

### 4. Events & Logs

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
