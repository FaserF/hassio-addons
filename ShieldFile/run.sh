#!/bin/bash
source /usr/lib/bashio/bashio.sh

# Define paths
CONFIG_PATH="/data/filebrowser.json"
DB_PATH="/data/database.db"
CERT_DIR="/ssl"

bashio::log.info "🛡️ Starting ShieldFile Addon..."

# Read Config
CERT_FILE=$(bashio::config 'certfile')
KEY_FILE=$(bashio::config 'keyfile')
PORT=$(bashio::config 'port')
BASE_DIR=$(bashio::config 'base_directory')
LOG_LEVEL=$(bashio::config 'log_level')

# Users List
# We need to parse the list of users and creating them.
# Filebrowser stores users in DB. We should sync them on startup?
# Simple approach: Create the first user in list as admin if DB is new.
# Or iterate.
# For V1: Just ensure DB exists and set admin.

# Certificates
FULL_CERT_PATH="${CERT_DIR}/${CERT_FILE}"
FULL_KEY_PATH="${CERT_DIR}/${KEY_FILE}"

if bashio::fs.file_exists "${FULL_CERT_PATH}" && bashio::fs.file_exists "${FULL_KEY_PATH}"; then
    bashio::log.info "  Certificate found: ${FULL_CERT_PATH}"
else
    bashio::log.warning "  Certificate NOT found at ${FULL_CERT_PATH}. Generating Self-Signed..."
    mkdir -p "$(dirname "${FULL_CERT_PATH}")"
    mkdir -p "$(dirname "${FULL_KEY_PATH}")"
    openssl req -x509 -newkey rsa:4096 -sha256 -days 3650 \
      -nodes -keyout "${FULL_KEY_PATH}" -out "${FULL_CERT_PATH}" \
      -subj "/CN=shieldfile-addon" \
      -addext "subjectAltName=DNS:shieldfile-addon,IP:127.0.0.1"
fi

# Initialize DB if missing
if [ ! -f "$DB_PATH" ]; then
    bashio::log.info "📁 Initializing Database at ${DB_PATH}..."
    filebrowser config init --database "$DB_PATH"

    # Set Branding
    filebrowser config set --branding.name "ShieldFile" --branding.disableExternal --database "$DB_PATH"

    # Set Port/Cert in DB? Or just pass via CLI?
    # CLI is easier for runtime config changes (like Cert path or Port)
    # But Filebrowser prefers config file or DB for some things.
    # We will use CLI flags for listener settings to override DB.
else
    bashio::log.info "📁 Database found."
fi

# Add/Update Users
# Iterate over users list options
# Note: This might reset passwords on every restart if we are not careful.
# But "Config as Code" implies the Config is the source of truth.
# We will iterate and `users add` or `users update`.
bashio::log.info "👤 syncing users..."

for user in $(bashio::config 'users|keys'); do
    USERNAME=$(bashio::config "users[${user}].username")
    PASSWORD=$(bashio::config "users[${user}].password")

    # Try add (fails if exists), then update
    if filebrowser users add "$USERNAME" "$PASSWORD" --perm.admin --database "$DB_PATH" 2>/dev/null; then
        bashio::log.info "  Created user: $USERNAME"
    else
        filebrowser users update "$USERNAME" "$PASSWORD" --perm.admin --database "$DB_PATH"
        bashio::log.info "  Updated user: $USERNAME"
    fi
done


# Start
bashio::log.info "🚀 ShieldFile listening on port ${PORT} (Root: ${BASE_DIR})"

# Construct Args
ARGS=""
ARGS="$ARGS --port $PORT"
ARGS="$ARGS --root $BASE_DIR"
ARGS="$ARGS --database $DB_PATH"
ARGS="$ARGS --cert $FULL_CERT_PATH"
ARGS="$ARGS --key $FULL_KEY_PATH"
ARGS="$ARGS --address 0.0.0.0" # Listen on all interfaces (Host Network)

# Run
exec filebrowser $ARGS
