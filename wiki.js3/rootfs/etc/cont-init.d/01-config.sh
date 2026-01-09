#!/usr/bin/with-contenv bashio
# shellcheck disable=SC1091

ssl=$(bashio::config 'ssl')
certfile=$(bashio::config 'certfile')
keyfile=$(bashio::config 'keyfile')
log_level=$(bashio::config 'log_level')

# Retrieve config variables
host="localhost"
port="5432"
username="postgres"
password=$(bashio::config 'db_password')

# SSL validation
if [ "$ssl" = "true" ]; then
	bashio::log.info "SSL is enabled. Validating certificates..."
	if [ ! -f "/ssl/$certfile" ]; then
		bashio::log.error "Cannot find certificate file $certfile. Turn off SSL or check if the file exists at /ssl/"
		exit 1
	fi
	if [ ! -f "/ssl/$keyfile" ]; then
		bashio::log.error "Cannot find certificate key file $keyfile. Turn off SSL or check if the file exists at /ssl/"
		exit 1
	fi
	bashio::log.info "SSL certificates validated."
fi

# Ensure /config directory exists
mkdir -p /config

# Generate configuration content once
CONFIG_CONTENT=$(
	cat <<EOF
port: 3011
db:
  type: postgres
  host: ${host}
  port: ${port}
  user: ${username}
  pass: ${password}
  db: wiki
  ssl: false
ssl:
  enabled: ${ssl}
  port: 3443
  provider: custom
  format: pem
  key: /ssl/${keyfile}
  cert: /ssl/${certfile}
bindIP: 0.0.0.0
logLevel: ${log_level}
offline: false
dataPath: ./data
EOF
)

# Create Config file at the location Wiki.js expects
CONFIG_FILE="/config/wikijs-config.yml"
if [ ! -f "$CONFIG_FILE" ]; then
	bashio::log.info "Configuration file not found. Creating $CONFIG_FILE..."
	echo "$CONFIG_CONTENT" >"$CONFIG_FILE"
	bashio::log.info "Configuration file created successfully."
else
	# Check if content has changed
	current_content=$(cat "$CONFIG_FILE")
	if [ "$current_content" != "$CONFIG_CONTENT" ]; then
		bashio::log.info "Configuration has changed. Updating $CONFIG_FILE..."
		echo "$CONFIG_CONTENT" >"$CONFIG_FILE"
		bashio::log.info "Configuration file updated successfully."
	fi
fi

# Also create config.yml in /wiki for backward compatibility
echo "$CONFIG_CONTENT" >/wiki/config.yml
