# Home Assistant Add-on: Google Antigravity Quota Monitor

Google Antigravity is an AI development platform powered by Google DeepMind and Gemini models. This Home Assistant Addon monitors your Antigravity quotas, rolling 5-hour limit windows, weekly request limits, model quotas (Gemini 2.5 Pro, Flash, Thinking), and credit balances with support for multiple Google accounts, adaptive dynamic polling, and a modern dark-theme Ingress Web UI.

---

## Features

- **Multi-Account Support**: Monitor multiple Google accounts from a single dashboard.
- **Dynamic & Adaptive Polling**:
  - Configurable base scan interval (default: 30 minutes / 1800s).
  - **Adaptive Fast Polling**: If active quota usage was detected within the last 15 minutes, automatically increases polling frequency (e.g. every 3 minutes / 180s).
  - **Idle Backoff**: If no quota changes occur for > 2 hours, scales back to 60 minutes to save API calls and bandwidth.
- **Ingress Web Dashboard**:
  - Circular progress gauges for 5-hour rolling limits and weekly request quotas.
  - Reset countdown timers ("Resets in 2h 15m", "Resets in 4d 12h").
  - Plan tier badge and credit balances.
  - Model quota breakdown (Gemini 2.5 Pro, Gemini 2.5 Flash, Gemini Flash Thinking).
  - **"Refresh Now" button** for manual immediate sync.
  - Interactive **Setup Guide & Credential Verification Tool**.
- **Home Assistant Integration Ready**: Exposes a REST API (`/api/status`, `/api/accounts`, `/api/refresh`) consumed by the custom component integration.

---

## Authentication & Multi-Account Setup

To allow the addon to check your Antigravity quotas, you need an OAuth2 `refresh_token` from Google.

### Method 1: Using Antigravity IDE / Gemini CLI Credentials (Easiest)

If you already use Antigravity IDE or Gemini CLI on your PC, credentials already exist:

- **Windows**: `C:\Users\<YourUsername>\.gemini\antigravity\` or `%APPDATA%\gcloud\application_default_credentials.json`
- **macOS / Linux**: `~/.gemini/antigravity/` or `~/.config/gcloud/application_default_credentials.json`

Open the JSON file and copy the `refresh_token` string.

### Method 2: Generating via Google Cloud SDK (`gcloud`)

1. Install `gcloud` CLI on your computer.
2. Run the command in your terminal:

   ```bash
   gcloud auth application-default login
   ```

3. Complete the login in your web browser.
4. Locate the generated `application_default_credentials.json` file.
5. Copy the `"refresh_token"` field value.

### Method 3: Testing Credentials in the Addon UI

1. Open the Antigravity Addon from your Home Assistant sidebar (Ingress).
2. Click the **Setup Guide** button in the top right.
3. Paste your token or full JSON into the **Validate Credentials Tool** and click **Test & Validate**.
4. Once verified, paste the credentials into the Addon Configuration.

---

## Configuration Options

Example `config.yaml` options:

```yaml
log_level: info
scan_interval: 1800
adaptive_polling: true
fast_poll_interval: 180
idle_backoff_interval: 3600
accounts:
  - name: 'Personal Google Account'
    refresh_token: '1//0gxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'
    client_id: ''
    client_secret: ''
    project_id: 'antigravity-personal'
  - name: 'Work Account'
    refresh_token: '1//0gyyyyyyyyyyyyyyyyyyyyyyyyyyyyy'
    client_id: ''
    client_secret: ''
    project_id: 'antigravity-work'
```

| Option                  | Type   | Default | Description                                                       |
| ----------------------- | ------ | ------- | ----------------------------------------------------------------- |
| `log_level`             | string | `info`  | Logging verbosity (`trace`, `debug`, `info`, `warning`, `error`). |
| `scan_interval`         | int    | `1800`  | Standard base polling interval in seconds (30m).                  |
| `adaptive_polling`      | bool   | `true`  | Enables automatic polling frequency scaling.                      |
| `fast_poll_interval`    | int    | `180`   | Polling interval during active usage (3m).                        |
| `idle_backoff_interval` | int    | `3600`  | Polling interval during idle periods > 2h (60m).                  |
| `accounts`              | list   | `[...]` | List of Google accounts to monitor.                               |

---

## REST API Reference

The addon provides REST endpoints accessible via Ingress or direct port `8199`:

- `GET /api/status`: Returns complete status, active account, and all account quotas.
- `GET /api/accounts`: Returns list of all configured account summaries.
- `GET /api/accounts/{account_name}/quota`: Returns detailed quota for a specific account.
- `POST /api/refresh`: Forces an immediate refresh of all accounts.
- `POST /api/test-credentials`: Validates credentials payload.
- `GET /healthz`: Standard healthcheck endpoint.
