#!/usr/bin/with-contenv bashio
# shellcheck disable=SC2034,SC2129,SC2016
# shellcheck shell=bash

# Enable strict mode
set -e
# shellcheck disable=SC1091



ssl=$(bashio::config 'ssl')
certfile=$(bashio::config 'certfile')
keyfile=$(bashio::config 'keyfile')
log_level=$(bashio::config 'log_level')

declare host
declare password
declare port
declare username

if [ "$ssl" = "true" ]; then
	echo "You have activated SSL. SSL Settings will be applied"
	if [ ! -f "/ssl/$certfile" ]; then
		bashio::log.error "Cannot find certificate file $certfile . Turn off SSL or check for if the file really exists at /ssl/"
		exit 1
	fi
	if [ ! -f "/ssl/$keyfile" ]; then
		bashio::log.error "Cannot find certificate key file $keyfile . Turn off SSL or check for if the file really exists at /ssl/"
		exit 1
	fi
fi

# Require mariadb service to be available
if ! bashio::services.available "mysql"; then
	bashio::log.error "This add-on requires the MariaDB core add-on 2.0 or newer!"
	bashio::exit.nok "Make sure the MariaDB add-on is installed and running"
fi

host=$(bashio::services "mysql" "host")
password=$(bashio::services "mysql" "password")
port=$(bashio::services "mysql" "port")
username=$(bashio::services "mysql" "username")

if [ -z "$host" ]; then
	bashio::log.warning "MariaDB connection details not found. Waiting..."
	# Retry for up to 5 minutes (30 * 10s)
	for i in {1..30}; do
		sleep 10
		host=$(bashio::services "mysql" "host")
		if [ -n "$host" ]; then
			break
		fi
		bashio::log.debug "Waiting for MariaDB... ($i/30)"
	done

	if [ -z "$host" ]; then
		bashio::log.error "MariaDB not found after waiting. Exiting."
		exit 1
	fi
	# Refresh other variables if host found later
	password=$(bashio::services "mysql" "password")
	port=$(bashio::services "mysql" "port")
	username=$(bashio::services "mysql" "username")
fi

#Drop database based on config flag
if bashio::config.true 'reset_database'; then
	bashio::log.warning 'Recreating database'
	echo "DROP DATABASE IF EXISTS wiki;" |
		mariadb -h "${host}" -P "${port}" -u "${username}" -p"${password}" --skip_ssl

	#Remove reset_database option
	bashio::addon.option 'reset_database'
fi

# Ensure /config directory exists
mkdir -p /config

# Create Config file at the location Wiki.js expects
CONFIG_FILE="/config/wikijs-config.yml"
if [ ! -f "$CONFIG_FILE" ]; then
	bashio::log.info "Configuration file not found. Creating $CONFIG_FILE..."
	cat > "$CONFIG_FILE" <<EOF
port: 3000
db:
  type: mariadb
  host: ${host}
  port: ${port}
  user: ${username}
  pass: ${password}
  db: wiki
ssl:
  enabled: ${ssl}
  port: 3443
  provider: custom
  format: pem
  key: /ssl/${keyfile}
  cert: /ssl/${certfile}
pool:
bindIP: 0.0.0.0
logLevel: ${log_level}
offline: false
ha: false
dataPath: ./data
EOF
	bashio::log.info "Configuration file created successfully."
else
	bashio::log.info "Configuration file already exists at $CONFIG_FILE. Updating with current settings..."
	cat > "$CONFIG_FILE" <<EOF
port: 3000
db:
  type: mariadb
  host: ${host}
  port: ${port}
  user: ${username}
  pass: ${password}
  db: wiki
ssl:
  enabled: ${ssl}
  port: 3443
  provider: custom
  format: pem
  key: /ssl/${keyfile}
  cert: /ssl/${certfile}
pool:
bindIP: 0.0.0.0
logLevel: ${log_level}
offline: false
ha: false
dataPath: ./data
EOF
	bashio::log.info "Configuration file updated successfully."
fi

# Also create config.yml in /wiki for backward compatibility
cat >/wiki/config.yml <<EOF
port: 3000
db:
  type: mariadb
  host: ${host}
  port: ${port}
  user: ${username}
  pass: ${password}
  db: wiki
ssl:
  enabled: ${ssl}
  port: 3443
  provider: custom
  format: pem
  key: /ssl/${keyfile}
  cert: /ssl/${certfile}
pool:
bindIP: 0.0.0.0
logLevel: ${log_level}
offline: false
ha: false
dataPath: ./data
EOF

# Create database if not exists
echo "CREATE DATABASE IF NOT EXISTS wiki;" |
	mariadb -h "${host}" -P "${port}" -u "${username}" -p"${password}" --skip_ssl

# Verify config file exists before starting
if [ ! -f "$CONFIG_FILE" ]; then
	bashio::log.error "Configuration file $CONFIG_FILE was not created! Cannot start Wiki.js."
	exit 1
fi

bashio::log.info "Configuration file verified at $CONFIG_FILE"
bashio::log.info "Starting Wiki.JS from /wiki directory..."

# Set environment variable to tell Wiki.js where to find the config file
export CONFIG_FILE="$CONFIG_FILE"

# Change to wiki directory and start
cd /wiki || exit 1
exec node server
