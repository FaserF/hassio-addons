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
bashio::log.info "📝 Generating Corefile..."

cat <<EOF > ${COREFILE_PATH}
tls://.:${DOT_PORT} {
    tls ${FULL_CERT_PATH} ${FULL_KEY_PATH}
    forward . ${UPSTREAM_DNS}
    $(echo -e ${DNS_LOG_CONFIG})
}

https://.:${DOH_PORT} https://.:${DOH_ALT1} https://.:${DOH_ALT2} {
    tls ${FULL_CERT_PATH} ${FULL_KEY_PATH}
    forward . ${UPSTREAM_DNS}
    $(echo -e ${DNS_LOG_CONFIG})
}
EOF

# Start CoreDNS (Foreground - keeps service alive)
bashio::log.info "🚀 Starting CoreDNS..."
exec /usr/bin/coredns -conf ${COREFILE_PATH}
