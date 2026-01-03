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

#Drop database based on config flag (with safeguards)
if bashio::config.true 'reset_database'; then
	if ! bashio::config.true 'reset_database_confirm'; then
		bashio::log.error "Database reset requires both 'reset_database' and 'reset_database_confirm' to be enabled!"
		bashio::log.error "This is a DESTRUCTIVE operation that will DELETE ALL DATA!"
		bashio::log.error "Set 'reset_database_confirm: true' in your configuration to proceed."
		exit 1
	fi

	bashio::log.warning "=========================================="
	bashio::log.warning "WARNING: DESTRUCTIVE DATABASE OPERATION"
	bashio::log.warning "=========================================="
	bashio::log.warning "This will DROP the entire 'wiki' database!"
	bashio::log.warning "All data will be permanently lost!"
	bashio::log.warning "=========================================="

	# Create timestamped backup before dropping
	BACKUP_DIR="/config/backups"
	mkdir -p "$BACKUP_DIR"
	TIMESTAMP=$(date +%Y%m%d_%H%M%S)
	BACKUP_FILE="$BACKUP_DIR/wiki_backup_${TIMESTAMP}.sql"

	bashio::log.info "Creating backup before database reset..."
	bashio::log.info "Backup location: $BACKUP_FILE"

	# Create backup using mysqldump with MYSQL_PWD for security
	export MYSQL_PWD="${password}"
	if mysqldump -h "${host}" -P "${port}" -u "${username}" --skip-ssl wiki > "$BACKUP_FILE" 2>/dev/null; then
		bashio::log.info "Backup created successfully: $BACKUP_FILE"
	else
		bashio::log.warning "Backup failed (database may not exist yet), continuing with reset..."
	fi
	unset MYSQL_PWD

	bashio::log.warning 'Recreating database (dropping existing if present)...'
	echo "DROP DATABASE IF EXISTS wiki;" |
		MYSQL_PWD="${password}" mariadb -h "${host}" -P "${port}" -u "${username}" --skip_ssl

	#Remove reset_database options
	bashio::addon.option 'reset_database'
	bashio::addon.option 'reset_database_confirm'
fi

# Ensure /config directory exists
mkdir -p /config

# Generate configuration content once
CONFIG_CONTENT=$(cat <<EOF
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
)

# Create Config file at the location Wiki.js expects
CONFIG_FILE="/config/wikijs-config.yml"
if [ ! -f "$CONFIG_FILE" ]; then
	bashio::log.info "Configuration file not found. Creating $CONFIG_FILE..."
	echo "$CONFIG_CONTENT" > "$CONFIG_FILE"
	bashio::log.info "Configuration file created successfully."
else
	bashio::log.info "Configuration file already exists at $CONFIG_FILE. Updating with current settings..."
	echo "$CONFIG_CONTENT" > "$CONFIG_FILE"
	bashio::log.info "Configuration file updated successfully."
fi

# Also create config.yml in /wiki for backward compatibility
echo "$CONFIG_CONTENT" > /wiki/config.yml

# Create database if not exists
echo "CREATE DATABASE IF NOT EXISTS wiki;" |
	MYSQL_PWD="${password}" mariadb -h "${host}" -P "${port}" -u "${username}" --skip_ssl

echo "Starting Wiki.JS V3"
node server
