<img src="logo.png" align="right" width="128" height="128">

# ShieldDNS

ShieldDNS allows you to securely accept DNS-over-TLS (DoT) connections from your mobile devices and forward them to your local AdGuard Home or other DNS servers. This secures your DNS queries even when you are on your local network (if your device enforces Private DNS) or if you expose this port securely.

## Configuration

**Note**: You must have valid SSL certificates for the domain you are using. If you use the standard HA SSL setup, your certs are likely in `/ssl/`.

### Option: `upstream_dns` (Required)

The IP address of your upstream DNS server. This is usually your AdGuard Home IP, or `1.1.1.1` if you just want a DoT gateway to the internet.

### Option: `certfile` (Required)

The name of your certificate file in the `/ssl/` directory.
Example: `fullchain.pem`

### Option: `keyfile` (Required)

The name of your private key file in the `/ssl/` directory.
Example: `privkey.pem`

### Option: `cloudflare_tunnel_token` (Optional)

If you want to expose your DNS server via Cloudflare Tunnel (no port forwarding required), provide your Tunnel Token here.

1. Create a tunnel in Cloudflare Zero Trust Dashboard.
2. Select "Docker" as the environment.
3. Copy the token (the long string after `--token` in the installation command).
4. Paste it here.

### Option: `log_level` (Optional)

Set the verbosity of logs.

- `error`: Only show critical errors.
- `info`: Standard logging (includes DNS queries).
- `debug`: Verbose logging (useful for troubleshooting).

## Integrations

### Cloudflare Tunnel (Official Addon) support

You can use the official **Cloudflare Tunnel** Home Assistant Addon (or cloudflared docker container) to expose this addon to the internet without opening ports.

**Setup:**

1. In Cloudflare Dashboard, create a Public Hostname (e.g., `dns.example.com`).
2. Point the Service to `HTTPS://<YOUR_HA_IP>:443`.
3. Under **TLS Verify**, disable verification (No TLS Verify) or provide the CA if using self-signed certs.
4. Now `https://dns.example.com/dns-query` will serve DNS-over-HTTPS!

### AdGuard Home Integration

To usage this Addon as a secure frontend for **AdGuard Home**:

1. Install AdGuard Home Addon in Home Assistant.
2. Note the IP address of your Home Assistant (e.g., `192.168.1.50`).
3. In ShieldDNS configuration, set `upstream_dns` to this IP.
4. ShieldDNS will now accept encrypted requests and forward them locally to AdGuard Home.
5. **Port Conflicts**: AdGuard Home might try to bind port `443` (Web UI HTTPS) and `853` (DoT encryption).
   - If you want ShieldDNS to handle encryption, **disable encryption in AdGuard Home**.
   - If you need AdGuard Home Web UI on 443, change ShieldDNS `443` port mapping in the "Network" tab of the Addon to something else (e.g. `8443`).

## Supported Ports & Protocols

| Port | Protocol | Usage                      |
| ---- | -------- | -------------------------- |
| 853  | DoT      | Standard DNS-over-TLS      |
| 443  | DoH      | Standard DNS-over-HTTPS    |
| 784  | DoH      | Cloudflare Alternate HTTPS |
| 2443 | DoH      | Cloudflare Alternate HTTPS |

## Usage

1. Configure the options above.
2. Start the Addon.
3. On your Android device, go to **Settings > Network > Private DNS**.
4. Set "Private DNS provider hostname" to the domain name that matches your certificate.
5. Save. Your device will now send encrypted DNS queries to this Addon!

## Troubleshooting

Check the Addon logs. If the certificate is invalid or the path is wrong, CoreDNS will fail to start.
