#!/usr/bin/with-contenv bashio
# shellcheck disable=SC1091

bashio::log.info "🛡️ Initializing ShieldFile..."

# Define paths
DB_DIR="/data/shieldfile"
mkdir -p "${DB_DIR}"
DB_PATH="${DB_DIR}/database.db"
CERT_DIR="/ssl"

# Read Config
CERT_FILE=$(bashio::config 'certfile')
KEY_FILE=$(bashio::config 'keyfile')
PORT=$(bashio::config 'port')

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

	# Set Branding and Password Length
	filebrowser config set --branding.name "ShieldFile" --branding.disableExternal --minimumPasswordLength 8 --database "$DB_PATH"
else
	bashio::log.info "📁 Database found."
	# Ensure password length is set even if DB already exists
	filebrowser config set --minimumPasswordLength 8 --database "$DB_PATH"
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
			if filebrowser users update "$USERNAME" --password "$PASSWORD" --perm.admin --database "$DB_PATH"; then
				bashio::log.info "  Updated user: $USERNAME"
			else
				bashio::log.error "  Failed to update user: $USERNAME"
			fi
		else
			# User does not exist - create new
			if filebrowser users add "$USERNAME" "$PASSWORD" --perm.admin --database "$DB_PATH"; then
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
		bashio::log.warning "  Creating default user: admin / changeme1234"
		bashio::log.warning "  ⚠️  PLEASE CHANGE THE DEFAULT PASSWORD!"
		if filebrowser users add "admin" "changeme1234" --perm.admin --database "$DB_PATH"; then
			bashio::log.info "  Default admin user created successfully."
		else
			bashio::log.error "  Failed to create default admin user!"
		fi
	fi
fi

# ------------------------------------------------------------------------------
# Ingress & Network Setup
# ------------------------------------------------------------------------------

# Get Ingress Entry
if bashio::var.has_value "$(bashio::addon.ingress_entry)"; then
	INGRESS_ENTRY=$(bashio::addon.ingress_entry)
else
	INGRESS_ENTRY="/"
fi
bashio::log.info "ℹ️  Ingress Entry Path: ${INGRESS_ENTRY}"

# Write Ingress Entry to file for FileBrowser service to pick up
mkdir -p /var/run/shieldfile
echo "${INGRESS_ENTRY}" >/var/run/shieldfile/ingress_entry

# Setup Nginx
bashio::log.info "🔧 Generating Nginx Configuration..."
mkdir -p /run/nginx /etc/nginx/http.d

cat <<EOF >/etc/nginx/http.d/default.conf
# Ingress Server
server {
    listen 8099;
    server_name _;

    # Allow large file uploads
    client_max_body_size 0;

    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}

# Direct Access Server (HTTPS)
server {
    listen ${PORT} ssl;
    server_name _;

    ssl_certificate ${FULL_CERT_PATH};
    ssl_certificate_key ${FULL_KEY_PATH};
    ssl_protocols TLSv1.2 TLSv1.3;

    # Allow large file uploads
    client_max_body_size 0;

    # Redirect Root to BaseURL (Ingress Path)
    # This ensures directly accessing https://IP:PORT/ works by jumping to the correct path
    location = / {
        return 301 ${INGRESS_ENTRY}/;
    }

    # Handle the App Path
    location ${INGRESS_ENTRY} {
        proxy_pass http://127.0.0.1:8080;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
EOF
