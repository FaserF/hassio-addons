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

### Option: `dot_port` (Optional)
Port to listen for DNS-over-TLS. Default: `8853`.

### Option: `doh_port` (Optional)
Port to listen for DNS-over-HTTPS. Default: `3443`.
_Note: Default is 3443 to avoid conflict with Home Assistant UI on 443._

### Option: `doh_alt_port_1` & `doh_alt_port_2` (Optional)
Optional additional ports for DoH/HTTPS (e.g. 784, 2443). Disabled by default.

## Networking

This Addon runs in **Host Network** mode to preserve the "Source IP" of DNS queries.
This means:

1.  **Source IPs**: AdGuard Home will see the real IP of the client (e.g. your phone).
2.  **Ports**: The ports configured above are opened directly on your Host device.
3.  **Conflicts**: Ensure these ports are not used by other services (like AdGuard Home encryption or Nginx Proxy Manager).

## Integrations

### Cloudflare Tunnel (Official Addon) support

You can use the official **Cloudflare Tunnel** Home Assistant Addon (or cloudflared docker container) to expose this addon to the internet without opening ports.

**Setup:**

1. In Cloudflare Dashboard, create a Public Hostname (e.g., `dns.example.com`).
2. Point the Service to `HTTPS://localhost:3443` (or whatever `doh_port` you configured).
3. Under **TLS Verify**, disable verification (No TLS Verify) or provide the CA.

### AdGuard Home Integration

To usage this Addon as a secure frontend for **AdGuard Home**:

1. Install AdGuard Home Addon in Home Assistant.
2. Note the IP address/Host of your Home Assistant.
3. In ShieldDNS configuration, set `upstream_dns` to this IP.
4. ShieldDNS will now accept encrypted requests and forward them locally to AdGuard Home.
5. **Port Conflicts**: Since ShieldDNS runs on the Host Network, it cannot share ports with AdGuard Home if both try to bind the same port on all interfaces.
    - If AdGuard uses 443/853, change the ShieldDNS ports in the configuration (`dot_port`, `doh_port`) or disable encryption in AdGuard.

## Supported Protocols
| Parameter | Protocol | Default |
|-----------|----------|---------|
| `dot_port`| DoT      | 8853    |
| `doh_port`| DoH      | 3443    |

## Usage

1. Configure the options above.
2. Start the Addon.
3. On your Android device, go to **Settings > Network > Private DNS**.
4. Set "Private DNS provider hostname" to the domain name that matches your certificate.
5. Save. Your device will now send encrypted DNS queries to this Addon!

## 🛡️ Security Best Practices

Since you are exposing a DNS server to the public (via Tunnel or Port Forwarding), you should secure it to prevent abuse (DNS Amplification, Scanning, DDoS).

### 1. Cloudflare Tunnel (Highly Recommended)
Using Cloudflare Tunnel hides your Origin IP and allows you to use **Cloudflare Zero Trust** features.
- **WAF / Custom Rules**:
    - **Block Countries**: Block all countries except your own.
    - **Block Bots**: Enable "Bot Fight Mode" or block known bot User-Agents.
- **Rate Limiting**: Set a Rate Limiting rule for your hostname (e.g. max 50 requests / 10 seconds per IP) to prevent flooding.
- **Zero Trust Authentication**: If feasible, put the DNS endpoint behind Cloudflare Access (Note: This breaks standard DoH clients unless they support authentication headers).

### 2. General Firewalls
If running without Cloudflare (Direct Exposure):
- **Whitelist IPs**: Only allow your own mobile IP ranges or specific networks if possible.
- **Fail2Ban**: Monitor logs and ban abusive IPs (requires mounting logs to host).
- **Limit Rates**: Use `iptables` or UFW to limit connection rates on port 853/443.

## Troubleshooting

Check the Addon logs. If the certificate is invalid or the path is wrong, CoreDNS will fail to start.
