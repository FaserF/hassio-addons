#!/usr/bin/with-contenv bashio

# Define local paths
COREFILE_PATH="/etc/Corefile"
CERT_DIR="/ssl"

bashio::log.info "Starting ShieldDNS Addon..."

# Read configuration using Bashio
UPSTREAM_DNS=$(bashio::config 'upstream_dns')
CERT_FILE=$(bashio::config 'certfile')
KEY_FILE=$(bashio::config 'keyfile')
TUNNEL_TOKEN=$(bashio::config 'cloudflare_tunnel_token')
LOG_LEVEL=$(bashio::config 'log_level')

# Retrieve Certs
# Bashio handles /ssl mount automatically
FULL_CERT_PATH="${CERT_DIR}/${CERT_FILE}"
FULL_KEY_PATH="${CERT_DIR}/${KEY_FILE}"

# Logging
bashio::log.info "Configuration:"
bashio::log.info "  Upstream: ${UPSTREAM_DNS}"
bashio::log.info "  Cert:     ${FULL_CERT_PATH}"
bashio::log.info "  Level:    ${LOG_LEVEL}"

if bashio::fs.file_exists "${FULL_CERT_PATH}" && bashio::fs.file_exists "${FULL_KEY_PATH}"; then
    bashio::log.info "  Certificate found."
else
    bashio::log.warning "  Certificate NOT found at ${FULL_CERT_PATH} / ${FULL_KEY_PATH}!"
    bashio::log.info "  Generating Self-Signed Certificate..."

    # Ensure directory exists
    mkdir -p "$(dirname "${FULL_CERT_PATH}")"
    mkdir -p "$(dirname "${FULL_KEY_PATH}")"

    openssl req -x509 -newkey rsa:4096 -sha256 -days 3650 \
      -nodes -keyout "${FULL_KEY_PATH}" -out "${FULL_CERT_PATH}" \
      -subj "/CN=shielddns-addon" \
      -addext "subjectAltName=DNS:shielddns-addon,IP:127.0.0.1"

    bashio::log.info "  Self-signed certificate generated."
fi

# Fallback DNS Configuration
FALLBACK_DNS_ENABLED=$(bashio::config 'fallback_dns')
FALLBACK_DNS_SERVER=$(bashio::config 'fallback_dns_server')

# Default if not set (though schema should handle defaults)
if ! bashio::config.has_value 'fallback_dns'; then FALLBACK_DNS_ENABLED="false"; fi
if ! bashio::config.has_value 'fallback_dns_server'; then FALLBACK_DNS_SERVER="1.1.1.1"; fi


# Check Reachability and Fallback Logic
ACTIVE_DNS_SERVER="${UPSTREAM_DNS}"
DNS_MODE="Main"

if [ "${FALLBACK_DNS_ENABLED}" = "true" ]; then
    bashio::log.info "🔍 Checking availability of Upstream DNS: ${UPSTREAM_DNS}"

    # Using ping.
    # Addon environment usually has ping/nc. We'll use ping with timeout.
    if ping -c 1 -W 2 "${UPSTREAM_DNS}" &> /dev/null; then
         bashio::log.info "✅ Upstream DNS (${UPSTREAM_DNS}) is reachable."
    else
         bashio::log.warning "⚠️  Upstream DNS (${UPSTREAM_DNS}) is NOT reachable!"
         bashio::log.warning "🔄 Switching to Fallback DNS: ${FALLBACK_DNS_SERVER}"
         ACTIVE_DNS_SERVER="${FALLBACK_DNS_SERVER}"
         DNS_MODE="Fallback"
    fi
else
    bashio::log.info "ℹ️  Fallback DNS is disabled. Using configured Upstream: ${UPSTREAM_DNS}"
fi

# Write Status for Info Page
# The addon info page is served by Nginx if enabled.
mkdir -p /var/www/html
cat <<EOF > /var/www/html/status.json
{
  "status": "online",
  "mode": "${DNS_MODE}",
  "upstream": "${ACTIVE_DNS_SERVER}",
  "checked_at": "$(date)"
}
EOF

# Determine CoreDNS Log Config
DNS_LOG_CONFIG="errors"
if [[ "${LOG_LEVEL}" == "info" ]] || [[ "${LOG_LEVEL}" == "debug" ]]; then
    DNS_LOG_CONFIG="${DNS_LOG_CONFIG}\n    log"
fi
if [[ "${LOG_LEVEL}" == "debug" ]]; then
    DNS_LOG_CONFIG="${DNS_LOG_CONFIG}\n    debug"
fi

# Start Cloudflare Tunnel (Background)
if bashio::config.has_value 'cloudflare_tunnel_token'; then
    bashio::log.info "🚇 Starting Cloudflare Tunnel..."

    TUNNEL_LOG="info"
    if [[ "${LOG_LEVEL}" == "debug" ]]; then TUNNEL_LOG="debug"; fi
    if [[ "${LOG_LEVEL}" == "error" ]]; then TUNNEL_LOG="error"; fi

    cloudflared tunnel run --token "${TUNNEL_TOKEN}" --loglevel "${TUNNEL_LOG}" &
else
    bashio::log.info "🚇 Cloudflare Tunnel disabled."
fi

# Generate Corefile
# Read port configuration
DOT_PORT=$(bashio::config 'dot_port')
DOH_PORT=$(bashio::config 'doh_port')
DOH_ALT1=$(bashio::config 'doh_alt_port_1')
DOH_ALT2=$(bashio::config 'doh_alt_port_2')

bashio::log.info "Configuration:"
bashio::log.info "  Upstream: ${UPSTREAM_DNS}"
bashio::log.info "  Cert:     ${FULL_CERT_PATH}"
bashio::log.info "  Level:    ${LOG_LEVEL}"
bashio::log.info "  Ports:    DoT:${DOT_PORT}, DoH:${DOH_PORT}, Alt:${DOH_ALT1}/${DOH_ALT2}"

# ... (cert logic) ...

# Generate Corefile

# ------------------------------------------------------------------------------
# Web Server & Single Port Logic (v1.3.0)
# ------------------------------------------------------------------------------
ENABLE_INFO_PAGE=$(bashio::config 'enable_info_page')
if ! bashio::config.has_value 'enable_info_page'; then ENABLE_INFO_PAGE="false"; fi

# Define internal port for CoreDNS if Nginx is fronting it
INTERNAL_DOH_PORT="5553"
ACTUAL_COREDNS_PORT="${DOH_PORT}"

# Check if DoH is actually enabled (Port is set)
if [ -z "${DOH_PORT}" ]; then
    if [ "${ENABLE_INFO_PAGE}" = "true" ]; then
        bashio::log.warning "Enable Info Page is TRUE, but DoH Port is NOT configured. Info Page will be ignored."
        ENABLE_INFO_PAGE="false"
    fi
fi

if [ "${ENABLE_INFO_PAGE}" = "true" ]; then
    bashio::log.info "🌍 Info Page ENABLED. Nginx will handle Port ${DOH_PORT}."

    # CoreDNS moves to internal port
    ACTUAL_COREDNS_PORT="${INTERNAL_DOH_PORT}"

    # Setup Nginx
    mkdir -p /run/nginx /etc/nginx/http.d

    # Nginx Config: Terminates TLS, Serves HTML, Proxies DNS
    cat <<EOF > /etc/nginx/http.d/default.conf
server {
    listen ${DOH_PORT} ssl http2;
    server_name _;
    root /var/www/html;
    index index.html;

    ssl_certificate ${FULL_CERT_PATH};
    ssl_certificate_key ${FULL_KEY_PATH};
    ssl_protocols TLSv1.2 TLSv1.3;

    # Logs
    error_log /dev/stderr info;
    access_log /dev/stdout;

    # 1. Info Page (Root)
    location / {
        try_files \$uri \$uri/ =404;
    }

    # 2. Proxy DoH to CoreDNS (Internal Loopback)
    location /dns-query {
        proxy_pass https://127.0.0.1:${INTERNAL_DOH_PORT};
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;

        # Websocket support (if needed for some DoH clients, though rare)
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";

        # Allow self-signed upstream
        proxy_ssl_verify off;
    }
}
EOF

    # Start Nginx in background
    nginx &
    NGINX_PID=$!
    bashio::log.info "   Nginx started with PID ${NGINX_PID} (Listening on ${DOH_PORT})"
else
    bashio::log.info "🌍 Info Page DISABLED. CoreDNS will handle Port ${DOH_PORT} directly."
fi


# Generate Corefile
bashio::log.info "📝 Generating Corefile..."

# Validation: At least one port must be active
if [ -z "${DOT_PORT}" ] && [ -z "${DOH_PORT}" ]; then
    bashio::log.fatal "❌ CRITICAL: Neither DOT_PORT nor DOH_PORT is set! ShieldDNS must listen on at least one port."
    exit 1
fi

# DoT Block
if [ -n "${DOT_PORT}" ]; then
    bashio::log.info "  Exposing DoT on Port: ${DOT_PORT}"
    cat <<EOF >> ${COREFILE_PATH}
tls://.:${DOT_PORT} {
    tls ${FULL_CERT_PATH} ${FULL_KEY_PATH}
    forward . ${ACTIVE_DNS_SERVER}
    $(echo -e ${DNS_LOG_CONFIG})
}
EOF
fi

# DoH Block (or internal proxy target)
if [ -n "${ACTUAL_COREDNS_PORT}" ]; then
    # Note: ACTUAL_COREDNS_PORT is either DOH_PORT or INTERNAL_DOH_PORT
    # We only write this if DOH_PORT was originally set (logic handled above in INFO_PAGE block)
    # Re-checking DOH_PORT emptiness just to be sure we don't bind empty port
    if [ -n "${DOH_PORT}" ]; then
         bashio::log.info "  Exposing DoH CoreDNS on Port: ${ACTUAL_COREDNS_PORT}"
         cat <<EOF >> ${COREFILE_PATH}
https://.:${ACTUAL_COREDNS_PORT} {
    tls ${FULL_CERT_PATH} ${FULL_KEY_PATH}
    forward . ${ACTIVE_DNS_SERVER}
    $(echo -e ${DNS_LOG_CONFIG})
}
EOF
    fi
fi

# Append Alt Ports if they are set (Always direct to CoreDNS for now, unless we want Nginx on those too?
# For simplicity, Alt ports remain pure CoreDNS for now as user only mentioned main DOH)
if bashio::config.has_value 'doh_alt_port_1'; then
    bashio::log.info "  Exposing Alt DoH Port 1: ${DOH_ALT1}"
    cat <<EOF >> ${COREFILE_PATH}
https://.:${DOH_ALT1} {
    tls ${FULL_CERT_PATH} ${FULL_KEY_PATH}
    forward . ${ACTIVE_DNS_SERVER}
    $(echo -e ${DNS_LOG_CONFIG})
}
EOF
fi

if bashio::config.has_value 'doh_alt_port_2'; then
    bashio::log.info "  Exposing Alt DoH Port 2: ${DOH_ALT2}"
    cat <<EOF >> ${COREFILE_PATH}
https://.:${DOH_ALT2} {
    tls ${FULL_CERT_PATH} ${FULL_KEY_PATH}
    forward . ${ACTIVE_DNS_SERVER}
    $(echo -e ${DNS_LOG_CONFIG})
}
EOF
fi

# Start CoreDNS (Foreground or Wait)
if [ -n "$TUNNEL_PID" ] || [ -n "$NGINX_PID" ]; then
    /usr/bin/coredns -conf ${COREFILE_PATH} &
    DNS_PID=$!

    # Wait for ANY
    PIDS="$DNS_PID $TUNNEL_PID $NGINX_PID"
    # Clean PIDS list (remove empty)
    PIDS=$(echo $PIDS | xargs)

    wait -n $PIDS

    bashio::log.error "❌ One of the processes exited. Shutting down..."
    kill $PIDS 2>/dev/null
    exit 1
else
    bashio::log.info "🚀 Starting CoreDNS..."
    exec /usr/bin/coredns -conf ${COREFILE_PATH}
fi