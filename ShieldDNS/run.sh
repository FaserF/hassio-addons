#!/usr/bin/with-contenv bash
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
    UPSTREAM_DNS=${UPSTREAM_DNS:-$DEFAULT_UPSTREAM}
    CERT_FILE=${CERT_FILE:-"/ssl/fullchain.pem"}
    KEY_FILE=${KEY_FILE:-"/ssl/privkey.pem"}
    LOG_LEVEL=${LOG_LEVEL:-"info"}
    DOT_PORT=${DOT_PORT:-853}
    DOH_PORT=${DOH_PORT:-443}
    FALLBACK_DNS_ENABLED=${FALLBACK_DNS_ENABLED:-"false"}
    FALLBACK_DNS_SERVER=${FALLBACK_DNS_SERVER:-"1.1.1.1"}
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
        echo "⚠️  Port 853 is BUSY. Switching DoT to Fallback Port: 8853"
        DOT_PORT="8853"
    fi
fi

# ------------------------------------------------------------------------------
# 3. Multiplexed Port 443 Configuration (DoH + Admin UI)
# ------------------------------------------------------------------------------
INTERNAL_DOH_PORT="5553"
ADMIN_BACKEND_PORT="8080"

echo "🌍 Unifying DoH and Admin UI on Port ${DOH_PORT} (multiplexed via Nginx)..."

mkdir -p /run/nginx /etc/nginx/http.d

cat <<EOF >/etc/nginx/http.d/default.conf
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
    }
}
EOF

nginx &
NGINX_PID=$!

# ------------------------------------------------------------------------------
# 4. ShieldDNS Admin & CoreDNS Execution
# ------------------------------------------------------------------------------
mkdir -p /etc/shielddns /var/www/admin

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
https://.:${ACTUAL_COREDNS_PORT} {
    tls ${CERT_FILE} ${KEY_FILE}
    forward . ${UPSTREAM_DNS}
    log
    errors
}
EOF
fi

/usr/bin/coredns -conf $COREFILE_PATH &
DNS_PID=$!

wait -n $ADMIN_PID $DNS_PID $NGINX_PID
kill $(jobs -p)
exit 1
