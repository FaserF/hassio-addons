# Documentation

ER-Startseite is a modern, highly customizable dashboard with a neon aesthetic.

## Access

The app can be accessed in two ways:

1. **Ingress (Recommended)**: Accessible directly via the Home Assistant sidebar. This use port `8099` internally and is proxied through Home Assistant (HTTPS).
2. **Direct Access**: Accessible via `http://<your-ip>:9123`. This port can be configured to use SSL in the app options.

## Configuration

| Option     | Type    | Default         | Description                                |
| ---------- | ------- | --------------- | ------------------------------------------ |
| `ssl`      | boolean | `false`         | Enable SSL for direct access on port 9123. |
| `certfile` | string  | `fullchain.pem` | SSL certificate file (stored in `/ssl/`).  |
| `keyfile`  | string  | `privkey.pem`   | SSL key file (stored in `/ssl/`).          |

## Advanced Configuration

The app uses the following internal environment variables which are pre-configured:

- `PROJECT_NAME`: The name of the project displayed in the UI.
- `BACKEND_CORS_ORIGINS`: Allowed origins for CORS.
- `POSTGRES_SERVER`: Database host (localhost).
- `POSTGRES_USER`: Database user (postgres).
- `POSTGRES_DB`: Database name (er_startseite).

### Database

The app includes a bundled PostgreSQL 17 instance. Data is persisted in the app's internal storage. If you ever need to reset the database, you can wipe the app data.

### Custom Backgrounds

You can upload your own background images and videos via the Web UI. These are stored within the app's persistent storage.
