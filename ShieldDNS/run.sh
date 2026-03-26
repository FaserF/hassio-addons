#!/usr/bin/with-contenv bashio
# shellcheck disable=SC1091
# shellcheck shell=bash

# Source bashio early for banner functions
[ -f /usr/lib/bashio/bashio.sh ] && source /usr/lib/bashio/bashio.sh

# Enable strict mode
set -e

# Define local paths
COREFILE_PATH="/etc/Corefile"
DEFAULT_UPSTREAM="1.1.1.1"

echo "➡️  Starting ShieldDNS Initialization..."

# ------------------------------------------------------------------------------
# 1. Environment Detection & Configuration
# ------------------------------------------------------------------------------
if [ -f "/data/options.json" ] && [ -n "$(command -v bashio::config)" ]; then
    bashio::log.info "ℹ️  Home Assistant Addon environment detected."
    
    UPSTREAM_DNS=$(bashio::config 'upstream_dns')
    UPSTREAM_DOT=$(bashio::config 'upstream_dot')
    PREFER_ENCRYPTED=$(bashio::config 'prefer_encrypted')
    CERT_FILE=$(bashio::config 'certfile')
    KEY_FILE=$(bashio::config 'keyfile')
    LOG_LEVEL=$(bashio::config 'log_level')
    DOT_PORT=$(bashio::config 'dot_port')
    DOH_PORT=$(bashio::config 'doh_port')
    FALLBACK_DNS_ENABLED=$(bashio::config 'fallback_dns')
    FALLBACK_DNS_SERVER=$(bashio::config 'fallback_dns_server')

    # Prepend /ssl/ to cert paths if they are just filenames
    if [[ "$CERT_FILE" != /* ]]; then CERT_FILE="/ssl/$CERT_FILE"; fi
    if [[ "$KEY_FILE" != /* ]]; then KEY_FILE="/ssl/$KEY_FILE"; fi
else
    echo "ℹ️  Standard Docker environment detected."
    UPSTREAM_DNS=${UPSTREAM_DNS:-"86.54.11.100 1.1.1.1 9.9.9.9 8.8.8.8 1.0.0.1"}
    UPSTREAM_DOT=${UPSTREAM_DOT:-"unfiltered.joindns4.eu dns.quad9.net one.one.one.one dns.google"}
    PREFER_ENCRYPTED=${PREFER_ENCRYPTED:-"true"}
    CERT_FILE=${CERT_FILE:-"/ssl/fullchain.pem"}
    KEY_FILE=${KEY_FILE:-"/ssl/privkey.pem"}
    LOG_LEVEL=${LOG_LEVEL:-"info"}
    DOT_PORT=${DOT_PORT:-853}
    DOH_PORT=${DOH_PORT:-443}
    FALLBACK_DNS_ENABLED=${FALLBACK_DNS_ENABLED:-"false"}
    FALLBACK_DNS_SERVER=${FALLBACK_DNS_SERVER:-"1.1.1.1"}
fi

# Sanitize upstreams (replace commas with spaces)
UPSTREAM_DNS=$(echo "${UPSTREAM_DNS}" | tr ',' ' ')
UPSTREAM_DOT=$(echo "${UPSTREAM_DOT}" | tr ',' ' ')

# ------------------------------------------------------------------------------
# 1.5. SSL Fallback Check
# ------------------------------------------------------------------------------
if [ ! -f "$CERT_FILE" ] || [ ! -f "$KEY_FILE" ]; then
    bashio::log.warning "⚠️  WARNING: SSL Certificates not found at ${CERT_FILE} or ${KEY_FILE}!"
    bashio::log.info "⚙️  Generating self-signed fallback certificate..."
    
    mkdir -p /etc/shielddns/ssl
    FALLBACK_CERT="/etc/shielddns/ssl/selfsigned.crt"
    FALLBACK_KEY="/etc/shielddns/ssl/selfsigned.key"
    
    if [ ! -f "$FALLBACK_CERT" ]; then
        openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
            -keyout "$FALLBACK_KEY" -out "$FALLBACK_CERT" \
            -subj "/C=DE/ST=ShieldDNS/L=ShieldDNS/O=ShieldDNS/OU=ShieldDNS/CN=shielddns.local" \
            2>/dev/null
    fi
    
    CERT_FILE="$FALLBACK_CERT"
    KEY_FILE="$FALLBACK_KEY"
    bashio::log.info "✅  ShieldDNS will continue with self-signed certificates (Insecure)."
fi

# ------------------------------------------------------------------------------
# 2. Port Conflict & Availability Checks
# ------------------------------------------------------------------------------
is_port_busy() {
    local PORT=$1
    if [ -n "$PORT" ] && [ "$PORT" != "null" ]; then
        if nc -z 127.0.0.1 "$PORT" 2>/dev/null; then return 0; fi
    fi
    return 1
}

if is_port_busy "${DOT_PORT}"; then
    if [ "${DOT_PORT}" = "853" ]; then
        bashio::log.warning "⚠️  Port 853 is BUSY. Switching DoT to Fallback Port: 8853"
        DOT_PORT="8853"
    fi
fi

# ------------------------------------------------------------------------------
# 3. Multiplexed Port 443 Configuration (DoH + Admin UI)
# ------------------------------------------------------------------------------
INTERNAL_DOH_PORT="5553"
ADMIN_BACKEND_PORT="8080"

bashio::log.info "🌍 Unifying DoH and Admin UI on Port ${DOH_PORT} (multiplexed via Nginx)..."

mkdir -p /run/nginx /etc/nginx/http.d

cat <<EOF >/etc/nginx/http.d/default.conf
server {
    listen 80;
    server_name _;
    
    location / {
        proxy_pass http://127.0.0.1:${ADMIN_BACKEND_PORT};
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}

server {
    listen ${DOH_PORT} ssl;
    http2 on;
    server_name _;

    ssl_certificate ${CERT_FILE};
    ssl_certificate_key ${KEY_FILE};
    ssl_protocols TLSv1.2 TLSv1.3;

    error_log /dev/stderr info;
    access_log /dev/stdout;

    location /dns-query {
        proxy_pass https://127.0.0.1:${INTERNAL_DOH_PORT};
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_http_version 1.1;
        proxy_ssl_verify off;
    }

    location / {
        proxy_pass http://127.0.0.1:${ADMIN_BACKEND_PORT};
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-Proto \$scheme;

        # SSE optimization
        proxy_set_header Connection '';
        proxy_http_version 1.1;
        proxy_buffering off;
        proxy_cache off;
        proxy_read_timeout 24h;
        gzip off;
    }
}
EOF

nginx -g 'daemon off;' &
NGINX_PID=$!

# ------------------------------------------------------------------------------
# 4. ShieldDNS Admin & CoreDNS Execution
# ------------------------------------------------------------------------------
mkdir -p /etc/shielddns /var/www/admin

# Dynamically set GOMAXPROCS to match the available CPU count.
export GOMAXPROCS=$(nproc 2>/dev/null || echo 1)

# Export for Go backend
export CERT_FILE
export KEY_FILE
export INTERNAL_DOH_PORT
export ADMIN_PORT=${ADMIN_BACKEND_PORT}

/usr/bin/shielddns-admin &
ADMIN_PID=$!

# Initial Corefile (if backend hasn't generated one yet)
ACTUAL_COREDNS_PORT="${INTERNAL_DOH_PORT}"
if [ ! -f "$COREFILE_PATH" ]; then
    cat <<EOF > $COREFILE_PATH
.:53 {
    bind 0.0.0.0
    forward . ${UPSTREAM_DNS}
    log
    errors
}
tls://.:853 {
    tls ${CERT_FILE} ${KEY_FILE}
    forward . ${UPSTREAM_DNS}
    log
    errors
}
https://.:${ACTUAL_COREDNS_PORT} {
    tls ${CERT_FILE} ${KEY_FILE}
    forward . ${UPSTREAM_DNS}
    log
    errors
}
EOF
fi

# CoreDNS is managed by the Go backend (shielddns-admin)
# so it handles log parsing and restarts automatically.

wait -n $ADMIN_PID $NGINX_PID
bashio::log.info "⏹️  Shutting down services..."
# Kill all background jobs gracefully
kill -TERM $(jobs -p) 2>/dev/null || true
bashio::log.info "ℹ️  ShieldDNS has stopped."
exit 0
