# Trade Republic Headless Browser Add-on Documentation

## How It Works

The add-on runs a lightweight headless Chromium browser inside an isolated Alpine container. When initialized:

1. It navigates to Trade Republic's web portal (app.traderepublic.com).
2. Solves the AWS WAF JavaScript challenge.
3. Obtains and keeps the r_session token cookie alive.
4. Serves the active token via local REST API (/api/v1/session) to the Home Assistant integration.

## Configuration Options

- `keep_alive_interval`: Interval in seconds between background session refresh checks (default: 600s).
- `cache_retention_hours`: Duration in hours to retain and serve cached portfolio and metric data during session dropouts or offline periods (default: 12h).
- `auto_install_integration`: Automatically download and install/update the `ha-traderepublic` custom integration into `/config/custom_components`.
