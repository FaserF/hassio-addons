# WhatsApp Documentation

> [!TIP]
> **Rocket.Chat & Webhook Support**: Did you know? You can bridge WhatsApp to **Rocket.Chat** or use **Webhooks** for custom integrations. See the **[Rocket.Chat Guide](https://faserf.github.io/ha-whatsapp/rocketchat.html)** and **[Webhook Guide](https://faserf.github.io/ha-whatsapp/webhooks.html)** for more.

---

Home Assistant WhatsApp Backend (Baileys/Node.js)

> [!WARNING]
> **Legal Disclaimer**
>
> This project is **not** affiliated with WhatsApp or Meta. Using automated messaging on a WhatsApp account may lead to its permanent ban. The developers assume no responsibility for any such damage.
>
> Official WhatsApp Policy: **[WhatsApp Terms of Service](https://www.whatsapp.com/legal/terms-of-service/)**

## Architecture

This app is a "bridge". It does **not** communicate with Home Assistant directly via the Event Bus. Instead, it acts as a server that the **WhatsApp Custom Component** connects to.

**Flow:**
`Home Assistant` -> `WhatsApp Integration` -> `HTTP (Port 8066)` -> `This App` -> `Baileys (Node.js)` -> `WhatsApp Web`

## 🔒 Security & Public Access

Requires Home Assistant 2024.12+ (or newer) to expose ports via the App configuration.

If you plan to use **Webhooks** or the **Rocket.Chat integration**, you may need to expose **Port 8066** to the internet (or at least to your Rocket.Chat instance).

> [!CAUTION]
> **Risk of Unauthorized Access**
> Exposing Port 8066 publicly makes the Web UI (containing your API Token and Logs) accessible to anyone.
>
> You **MUST** enable **UI Authentication** if you expose this port!

To enable password protection for the Web UI:

1. Set `ui_auth_enabled` to `true`.
2. Set a strong password in `ui_auth_password`.
3. When accessing the Web UI, use username: `admin` and your chosen password.

## 🚀 Getting Started with Automations

Once the App and integration are configured, check out the following resources to start building:

- [Installation](https://faserf.github.io/ha-whatsapp/installation.html)
- [Automations](https://faserf.github.io/ha-whatsapp/automations.html)
- [Rocket.Chat Integration](https://faserf.github.io/ha-whatsapp/rocketchat.html)
- [API Reference](https://faserf.github.io/ha-whatsapp/SERVICES.html)

### Reacting to Polls (Poll Updates)

When a user votes on a poll, a `whatsapp_message_received` event of type `poll_update` is fired.

Here is a working Home Assistant automation example to react to poll votes:

```yaml
alias: Pizza Poll Handler
trigger:
  - platform: event
    event_type: whatsapp_message_received
    event_data:
      type: poll_update
condition:
  - condition: template
    value_template: "{{ 'Pizza' in trigger.event.data.vote }}"
action:
  - action: whatsapp.send_message
    data:
      target: '{{ trigger.event.data.from }}'
      message: 'Great choice! 🍕'
```

> [!IMPORTANT]
>
> - **Filter by type**: Use the `type: 'poll_update'` trigger filter to match poll votes.
> - **Vote List**: `trigger.event.data.vote` is a **list** of selected option names.
> - **Decryption requirement**: Poll vote decryption only works if the addon has the original poll in its store (either the bot sent the poll, or the poll was received while the bot was online).

## 🛡️ WhatsApp Group Moderation & Defender Engine

The WhatsApp Addon incorporates a full-featured group moderation, defender, and command engine.

### Key Capabilities

- **Disabled by Default**: The moderation engine is globally disabled by default. Enable it per-group or globally via the Addon Web UI.
- **Group Rules & Agreement**: Define rules, automatically present rules on member joins (`!setrules`, `!rules <question>` AI interpretation).
- **Greetings, Goodbyes & Welcome Captcha**: Customizable welcome/goodbye templates (`!setwelcome`, `!setgoodbye`, `!welcome`, `!goodbye`), placeholders (`{mention}`, `{name}`, `{pushname}`, `{group}`, `{subject}`, `{title}`, `{count}`, `{members}`, `{rules}`, `{date}`, `{time}`), verification captchas (button/math/code), delivery target (group vs. private DM chat), and automated farewell messages with detailed kick/leave reasons (voluntary leave, captcha timeout, group ban, federation ban, warning threshold, admin removal).
- **Captcha Verification Dashboard & DM Resolution**: Web UI Overview panel to view pending/verified users per group and manually toggle verification status. Full support for solving captchas via Private Chat (DM) with automatic confirmation and group notifications.
- **Configurable User Addressing**: Configurable name resolution order (`Contact Name > Pushname > Phone Number`, `Pushname > Contact Name > Phone Number`, or `Phone Number Only`) and fallback preferences (`Phone Number` vs `@User`).
- **Custom Command Handler Modes**: Define custom group commands (`!wifi`, `!faq`, etc.) with 3 flexible execution modes:
  - 🤖 **Auto Reply**: Bot sends an automated text response.
  - 🏠 **HA / Webhook**: Event is forwarded to Home Assistant/Webhooks with no auto-reply (appears in `!help`).
  - 🔗 **Alias**: Redirects execution to any built-in or custom command target.
- **Speech-to-Text (STT) Auto-Transcription**: Cloud Speech-to-Text engine for incoming voice notes and audio messages (`stt_enabled: true/false`). Powered by Google Gemini 1.5 Multimodal Audio or OpenAI Whisper API (requires API key in Moderation settings). Quotes original audio message with multi-language (DE/EN) transcription and automated diagnostic error feedback.
- **Warnings System**: Configurable warning thresholds, warn decay (`decay_hours`), and automated penalties (`!warn`, `!unwarn`, `!warns`).
- **Granular Content Locks**: Toggle content locks per group for images, videos, audio, documents, stickers, URLs/links, group invite links, polls, contact cards, location shares, forwarded messages, and RTL text (`!lock`, `!unlock`, `!locks`, `!locktypes`).
- **Blacklist & Word Filters**: Match prohibited words or regex patterns with automated penalties.
- **Auto-Responder Filters & Saved Notes**: Keyword triggers (`!filter`, `!stop`, `!filters`), saved group notes (`!save`, `!get`, `!notes`, `#notename` auto-trigger).
- **User Management & Muting**: `!promote`, `!demote`, `!approve`, `!unapprove` (whitelist bypass), `!mute`, `!unmute` (messages auto-deleted), `!tban`, `!tmute` (duration-based penalties like `1d`, `12h`), `!info`, `!adminlist`, `!report` (alert admins).
- **Anti-Raid & Flood Protection**: Message rate limiting per user and high-velocity join detection with automatic group lockdown.
- **Bot Outbound Anti-Spam Shield 🛡️**: Active by default in all moderation-enabled groups. Prevents bot loops and accidental message floods by automatically muting bot replies for `msgs_in_5s * group_members` seconds (e.g. 5 msgs in 5s × 20 members = 100s mute) if the bot sends 5+ messages in 5 seconds in a chat. Sends one final warning notification before muting. (Telegram Relay messages are explicitly exempt).
- **Automated Moderation Testing**: Execute test suites directly from the Web UI using the _Generate Test Commands 🧪_ modal with optional Autonomous Mode and selective feature checkboxes. It runs commands with customizable delays, tracks bot responses, logs real-time progress, and sends an automated Markdown summary report to the group.

### 🧪 Automated Telegram Bridge & Moderation Test Suites

- **Telegram Bridge Native Test Suite**: Available in the Telegram tab of the Web UI under _Bridge Integration Test_. Performs end-to-end verification across ALL 16 native message & media types (Text, Poll, Poll Vote Sync, Location Pin, Event Card, Images, Voice Notes, Videos, Documents, WebP Stickers, Contact Cards, Emoji Reactions, Edits, Deletions, Thread Quotes, and System Events) for both WhatsApp → Telegram and Telegram → WhatsApp directions. Includes an interactive **Subtest Selection Matrix** (with Select All/None) to run specific subtests. Sends a comprehensive results summary to both chats upon completion.
- **Moderation Autonomous Test Mode**: Located in the Group Moderation panel under _Generate Test Commands 🧪_. Allows running safe or complete command test suites autonomously with selective subtest checkboxes, live step-by-step progress streaming, and group result reporting.

- **Native WhatsApp <-> Telegram Bridge**: Bi-directional message mirroring, automatic chat discovery, media sync, configurable metadata headers, and intelligent thread quote resolution across WhatsApp and Telegram.
- **Global Federations**: Network ban propagation across group clusters.
- **Gemini AI Engine**: Optional AI auto-responder for answering group FAQs, AI rules interpretation, and automated sentiment moderation (toxicity detection).
- **AI Translation Engine**: `!setlang <code>` and `!translate` via Gemini API.
- **1-Click Import & Export**: One-click JSON import/export for group moderation configurations.

### 🤖 Interactive Group Commands Reference (37 Commands)

The bot command engine supports configurable prefixes per group (default `!`) and Role-Based Access Control (RBAC).

| Command                     | Admin Only | Description                                                                                                          |
| :-------------------------- | :--------: | :------------------------------------------------------------------------------------------------------------------- |
| `!help`                     |     No     | Show contextual command list (hides admin commands for non-admins)                                                   |
| `!ping`                     |     No     | Check bot responsiveness                                                                                             |
| `!id`                       |     No     | Display chat and sender JIDs                                                                                         |
| `!rules [question]`         |     No     | Show group rules or ask a question about rules (AI interpretation)                                                   |
| `!info [@user]`             |     No     | View user information, warning history, Captcha status, and Whitelist approval status                                |
| `!adminlist` / `!admins`    |     No     | List all group administrators with superadmin/admin roles                                                            |
| `!locktypes`                |     No     | List all available content lock types                                                                                |
| `!report`                   |     No     | Tag all group admins with optional reason and quoted message                                                         |
| `!get <note>`               |     No     | Retrieve content of a saved note                                                                                     |
| `!notes`                    |     No     | List all saved group notes                                                                                           |
| `!filters`                  |     No     | List active auto-responder filters                                                                                   |
| `!welcome`                  |    Yes     | View current welcome message                                                                                         |
| `!goodbye`                  |    Yes     | View current goodbye message                                                                                         |
| `!locks`                    |    Yes     | List currently active content locks                                                                                  |
| `!translate [text]`         |     No     | Translate replied-to message or text using Gemini AI                                                                 |
| `!setrules <text>`          |    Yes     | Update group rules                                                                                                   |
| `!setwelcome <text>`        |    Yes     | Configure welcome message (`{mention}`, `{name}`, `{pushname}`, `{group}`, `{count}`, `{rules}`, `{date}`, `{time}`) |
| `!setgoodbye <text>`        |    Yes     | Configure goodbye message (`{mention}`, `{name}`, `{pushname}`, `{group}`, `{count}`, `{rules}`, `{date}`, `{time}`) |
| `!warn [@user] [reason]`    |    Yes     | Issue a warning to a user (mention or reply)                                                                         |
| `!unwarn [@user]`           |    Yes     | Clear all warnings for a user                                                                                        |
| `!warns [@user]`            |    Yes     | View warning history for a user                                                                                      |
| `!kick` / `!ban [@user]`    |    Yes     | Remove a user from the group                                                                                         |
| `!tban <duration> [@user]`  |    Yes     | Temporarily ban a user (e.g. `1d`, `12h`, `30m`)                                                                     |
| `!mute [@user]`             |    Yes     | Mute a user indefinitely (auto-deletes their messages)                                                               |
| `!tmute <duration> [@user]` |    Yes     | Temporarily mute a user for a specific duration                                                                      |
| `!unmute [@user]`           |    Yes     | Unmute a muted user                                                                                                  |
| `!del` / `!delete`          |    Yes     | Delete a replied-to message                                                                                          |
| `!promote [@user]`          |    Yes     | Promote a user to group admin                                                                                        |
| `!demote [@user]`           |    Yes     | Demote an admin to standard user                                                                                     |
| `!approve [@user]`          |    Yes     | Whitelist a user to bypass moderation locks and anti-spam                                                            |
| `!unapprove [@user]`        |    Yes     | Remove user from whitelist                                                                                           |
| `!lock <type>`              |    Yes     | Enable a content lock (`image`, `video`, `url`, `invite`, `rtl`, etc.)                                               |
| `!unlock <type>`            |    Yes     | Disable a content lock                                                                                               |
| `!save <name> <text>`       |    Yes     | Save a reusable group note (trigger via `#name`)                                                                     |
| `!filter <trigger> <reply>` |    Yes     | Create an auto-responder filter                                                                                      |
| `!stop <trigger>`           |    Yes     | Delete an auto-responder filter                                                                                      |
| `!setlang <code>`           |    Yes     | Set target language for translation                                                                                  |

---

## ⚙️ Configuration

Configure the app via the **Configuration** tab in the Home Assistant app page.

### Options

```yaml
log_level: info
reset_session: false
send_message_timeout: 25000
keep_alive_interval: 30000
mask_sensitive_data: false
webhook_enabled: false
webhook_url: ''
webhook_token: ''
ui_auth_enabled: false
ui_auth_password: ''
mark_online: false
media_folder: null
admin_numbers: ''
welcome_message_enabled: false
admin_notifications_enabled: true
message_send_interval: 1000
group_fetch_interval: 300000
group_fetch_cooldown_on_error: 60000
group_fetch_cooldown_on_rate_limit: 900000
sync_full_history: false
reject_unauthorized: true
auto_install_integration: true
github_token: ''
```

### Configuration Options

- `log_level`: Level of logs to output (trace, debug, info, warning, error, fatal).
- `reset_session`: (Default: `false`) Force the app to clear session data on startup and require a new QR code scan.
- `send_message_timeout`: Time (in ms) to wait for WhatsApp acknowledgement before timing out. Increase if you have slow network.
- `keep_alive_interval`: Time (in ms) between connection checks to prevent "Stale Connection".
- `mask_sensitive_data`: If true, `+491761234567` becomes `491*****67` in logs.
- `webhook_enabled`: (Default: `false`) Enable forwarding incoming messages to a webhook URL.
- `webhook_url`: The full URL to POST data to (e.g., `https://my-webhook.com/whatsapp`).
- `webhook_token`: (Optional) A secret token sent in the `X-Webhook-Token` header.
- `ui_auth_enabled`: Enables Basic Authentication for the Web UI (not the API).
- `ui_auth_password`: The password for the Web UI (Username is always `admin`).
- `mark_online`: (Default: `false`) If set to `true`, the app will mark your account as "Online" as long as it's running. Using `false` is recommended to avoid silencing notifications on your mobile phone.
- `media_folder`: (for example: `/media/whatsapp`) Path to a folder where received media (Images, Videos, Voice) should be saved. If set, files will **NOT** be automatically deleted. If cleared (`null` in the YAML config), files are stored internally and deleted after 24h.
- `admin_numbers`: Comma-separated list of phone numbers (e.g. `49176123456, 49176987654`) that are allowed to use `ha-app-*` admin commands.
- `welcome_message_enabled`: (Default: `false`) If true, the bot sends a role-aware welcome message on first-contact from a new user.
- `admin_notifications_enabled`: (Default: `true`) Automatically notifies admins about system health (WhatsApp loss/restore, HA Core/Integration updates, HA restarts).
- `message_send_interval`: (Default: `1000`) Delay in milliseconds between consecutive automated outgoing messages.
- `group_fetch_interval`: (Default: `300000`) Delay in milliseconds between fetching group metadata.
- `group_fetch_cooldown_on_error`: (Default: `60000`) Cooldown in milliseconds if fetching group metadata fails.
- `group_fetch_cooldown_on_rate_limit`: (Default: `900000`) Cooldown in milliseconds if fetching group metadata hits a rate limit.
- `sync_full_history`: (Default: `false`) Attempt to sync full chat history during initial pairing.
- `reject_unauthorized`: (Default: `true`) Set to `false` to disable SSL/TLS certificate validation (useful if fetching media from local integrations using self-signed certificates, such as Frigate).
- `auto_install_integration`: (Default: `true`) Automatically install the custom Home Assistant integration if missing.
- `github_token`: (Optional) GitHub Personal Access Token to avoid API rate limits when checking for updates.

> [!NOTE]
> **Standalone Docker Environment Variables**: In Standalone Docker mode, all configuration options can be passed via environment variables (case-insensitive, e.g. `WELCOME_MESSAGE_ENABLED=false` or `welcome_message_enabled=false`). Full variable reference available in the **[Configuration Docs](https://faserf.github.io/ha-whatsapp/configuration.html)**.

> [!CAUTION]
> **Privacy Consideration for `media_folder`**
> When a custom `media_folder` is set, all files in that directory are served publicly via the `/media` endpoint (e.g., `http://<host-ip>:8066/media/filename`).
>
> If you point this to a shared directory (like `/media/whatsapp`), ensure that no sensitive or private files are stored there, as they will be accessible without authentication if the port is exposed.

> [!WARNING]
> **Privacy Trade-off:** Enabling `mask_sensitive_data` will also mask Group IDs (e.g. `123*****89@g.us`). If you are trying to find out the ID of a new group to send messages to, you MUST temporarily **disable** this option to see the full ID in the logs.

> [!IMPORTANT]
> **Full History Sync (`sync_full_history`):**
>
> - **Pairing-Only Limitation:** WhatsApp's Multi-Device protocol sends historical chat data **only once during initial QR code pairing**. Enabling `sync_full_history` on an already paired session will **not** retrieve historical messages retroactively.
> - **How to sync history:** To sync chat history, set `sync_full_history: true`, reset the session (via `reset_session: true` or Web UI Session Reset), and scan the QR code again.
> - **WhatsApp Multi-Device Limits:** Meta limits historical message transfer to secondary linked devices to approximately the last 2–4 weeks (or ~50–100 messages per chat). Default is `false`.

## 📂 Folder Usage

- `/data`: Used for persistent session data (`auth_info_baileys`), API tokens (`api_token.txt`), and logs. This ensure you don't have to scan the QR code frequently.
- `/config`: Home Assistant configuration directory (mapped but not used by the app directly).

## Troubleshooting

### "Browser Context Closed"

If you see errors about the browser context, it might have crashed. The app is designed to restart the browser process automatically on the next request or crash the container to let Supervisor restart it.

### Session Lost

If you lose your session, you may need to re-scan the QR code. You can trigger a new scan by reinstalling the integration or (in future versions) calling a "Logout" service.

## Support

For issues and feature requests, please use the GitHub repository issues.

---

## 🎣 Webhook Support

You can configure this app to forward all incoming messages to a webhook URL. This is useful for custom integrations, logging, or bridging to other chat systems.

**Configuration:**

- `webhook_enabled`: Set to `true`
- `webhook_url`: The full URL to POST data to (e.g., `https://my-webhook.com/whatsapp`)
- `webhook_token`: (Optional) A secret token sent in the `X-Webhook-Token` header.

**Payload Format:**
The webhook will receive a JSON payload for every incoming message. See [Webhook Guide](https://faserf.github.io/ha-whatsapp/webhooks.html) for details.

## 🚀 Rocket.Chat Support

This app can be used as a bridge for Rocket.Chat using the **Rocket.Chat Apps** framework.

**Setup:**

1. Install the Rocket.Chat App (Apps > Marketplace > Private App).
2. Configure the App settings in Rocket.Chat with your App URL and API Token.
3. Enable Webhooks in this App and point them to your Rocket.Chat instance.

See the full **[Rocket.Chat Integration Guide](https://faserf.github.io/ha-whatsapp/rocketchat.html)** for step-by-step instructions.

---

## 🔔 Admin Status Notifications

If `admin_notifications_enabled` is set to `true`, all configured **Admins** will receive automatic WhatsApp alerts for critical system events:

- **WhatsApp Connection**: Notifies when the bot loses or restores its connection to WhatsApp (includes downtime duration).
- **Home Assistant Core**: Notifies when Home Assistant becomes unreachable or comes back online (e.g., during a restart or update).
- **Update Detection**:
  - **Addon/Integration**: Alerts when you've updated the WhatsApp App or the HA Integration.
  - **HA Core**: Automatically detects if a Core update was successful and reports the version change (e.g., `2024.2.1 ➔ 2024.3.0`).

## 👋 Welcome Message (First Contact)

The bot can automatically greet new users who send a direct message for the first time.

- **Role Awareness**: The message identifies if the user is an **Admin** or a **Standard User**.
- **Admin Tips**: Provides quick tips for administrators (`ha-app-status` and `ha-app-help`).
- **Support Links**: Includes a link to the project documentation.
- **Manual Trigger**: Use `ha-app-welcome` (Admin only) to manually trigger the message.

---

## 💡 Acknowledgments & Inspiration

The Group Moderation Engine, Content Locks, Security Federations, and Group Commands features in this project were inspired by the conceptual architecture of **Miss Rose** and **[AegisBot](https://github.com/FaserF/AegisBot)**.

- **AegisBot Project**: [https://github.com/FaserF/AegisBot](https://github.com/FaserF/AegisBot)
