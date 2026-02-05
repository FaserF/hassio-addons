# N8n Documentation

N8n (Nodemation) is an extendable workflow automation tool. With a fair-code distribution model, n8n will always have visible source code, available to self-host, and allows you to add your own custom functions, logic, and apps. N8n's node-based approach makes it highly versatile, enabling you to connect anything to everything.

[N8n Website](https://n8n.io)

## Installation

1. Search for the "N8n" app in the Supervisor app store.
2. Install the app.
3. Start the "N8n" app.
4. Check the logs of the "N8n" app to see if everything went well.
5. Click "OPEN WEB UI" to access the N8n interface.

## ⚙️ Configuration

**Note**: this app supports Ingress. You can verify this by checking if the "OPEN WEB UI" button is active.

### SSL/HTTPS Configuration

> **⚠️ Important**: SSL is **disabled by default** (`ssl: false`) to allow the app to start without pre-existing certificates.

**To enable SSL/HTTPS:**

1. **Place your SSL certificates** in the `/ssl` directory:
   - Certificate file: `/ssl/fullchain.pem` (default, or specify custom filename)
   - Private key file: `/ssl/privkey.pem` (default, or specify custom filename)

2. **Update the configuration**:

   ```yaml
   ssl: true
   certfile: fullchain.pem
   keyfile: privkey.pem
   ```

3. **Restart the app** to apply the changes.

### Options

```yaml
ssl: false
certfile: fullchain.pem
keyfile: privkey.pem
log_level: info
```

#### Option: `log_level`

The log level of the app.

## 📂 Folder Usage

- `/data/n8n`: Used for persistent storage of N8n data (workflows, credentials, etc.). This directory is preserved across app restarts and updates.
- `/ssl`: Used for SSL certificates (`certfile` and `keyfile`). **Required** if `ssl: true` is enabled. Place your certificate files here before enabling SSL.

## Support

Got questions?
You can open an issue here on GitHub.
