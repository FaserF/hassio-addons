#!/bin/bash
# shellcheck disable=SC1091,SC2034,SC2129,SC2016

# Enable strict mode
set -e

source /usr/lib/bashio/bashio.sh
# shellcheck disable=SC1091


# Get Addon Version

# Manually load S6 environment to ensure Bashio has access to SUPERVISOR_TOKEN
# This avoids using `with-contenv` which causes PID 1 errors in this context
if [ -d /var/run/s6/container_environment ]; then
	for var in /var/run/s6/container_environment/*; do
		[ -e "$var" ] || continue
		declare -x "$(basename "$var")=$(cat "$var")"
	done
fi

# Define paths
CONFIG_PATH="/data/filebrowser.json"
DB_PATH="/data/database.db"
CERT_DIR="/ssl"

bashio::log.info "🛡️ Starting ShieldFile Addon v1.0.8 (Debug: No-Contenv Mode)..."

# Read Config
CERT_FILE=$(bashio::config 'certfile')
KEY_FILE=$(bashio::config 'keyfile')
PORT=$(bashio::config 'port')
BASE_DIR=$(bashio::config 'base_directory')
LOG_LEVEL=$(bashio::config 'log_level')

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
else
	bashio::log.info "📁 Database found."
fi

# Add/Update Users
bashio::log.info "👤 Syncing users..."

user_count=0

# Check if users configuration exists and has entries
if bashio::config.has_value 'users'; then
	for user in $(bashio::config 'users|keys'); do
		USERNAME=$(bashio::config "users[${user}].username")
		PASSWORD=$(bashio::config "users[${user}].password")

		# Validate username and password
		if [ -z "$USERNAME" ]; then
			bashio::log.warning "  Skipping user entry ${user}: username is empty"
			continue
		fi

		if [ -z "$PASSWORD" ]; then
			bashio::log.warning "  Skipping user '${USERNAME}': password is empty"
			continue
		fi

		# Check if user already exists
		if filebrowser users find "$USERNAME" --database "$DB_PATH" &>/dev/null; then
			# User exists - update password
			if filebrowser users update "$USERNAME" --password "$PASSWORD" --perm.admin --database "$DB_PATH" 2>/dev/null; then
				bashio::log.info "  Updated user: $USERNAME"
			else
				bashio::log.error "  Failed to update user: $USERNAME"
			fi
		else
			# User does not exist - create new
			if filebrowser users add "$USERNAME" "$PASSWORD" --perm.admin --database "$DB_PATH" 2>/dev/null; then
				bashio::log.info "  Created user: $USERNAME"
			else
				bashio::log.error "  Failed to create user: $USERNAME"
			fi
		fi
		user_count=$((user_count + 1))
	done
fi

# If no users were configured/created, create a default admin user
if [ "$user_count" -eq 0 ]; then
	bashio::log.warning "No users configured in addon settings!"

	# Check if default admin already exists in database
	if filebrowser users find "admin" --database "$DB_PATH" &>/dev/null; then
		bashio::log.info "  Default 'admin' user already exists in database."
	else
		bashio::log.warning "  Creating default user: admin / changeme"
		bashio::log.warning "  ⚠️  PLEASE CHANGE THE DEFAULT PASSWORD!"
		if filebrowser users add "admin" "changeme" --perm.admin --database "$DB_PATH" 2>/dev/null; then
			bashio::log.info "  Default admin user created successfully."
		else
			bashio::log.error "  Failed to create default admin user!"
		fi
	fi
fi

# Start
bashio::log.info "🚀 ShieldFile listening on port ${PORT} (Root: ${BASE_DIR})"

# Construct Args
ARGS=()
ARGS+=("--port" "$PORT")
ARGS+=("--root" "$BASE_DIR")
ARGS+=("--database" "$DB_PATH")
ARGS+=("--cert" "$FULL_CERT_PATH")
ARGS+=("--key" "$FULL_KEY_PATH")
ARGS+=("--address" "0.0.0.0") # Listen on all interfaces (Host Network)

# Run
exec filebrowser "${ARGS[@]}"
