#!/usr/bin/with-contenv bashio
# shellcheck disable=SC2034,SC2129,SC2016
# shellcheck shell=bash

# Enable strict mode
set -e

# Get Addon Version
addon_version=$(bashio::addon.version)

# Banner Function
print_banner() {
    bashio::log.blue " \n"
    bashio::log.blue "-----------------------------------------------------------"
    bashio::log.blue " 📦 FaserF's Addon Repository"
    bashio::log.blue " 🔗 GitHub: https://github.com/FaserF/hassio-addons"
    bashio::log.blue "-----------------------------------------------------------\n"

    # Version Checks
    if [[ "$addon_version" == *"dev"* ]]; then
        bashio::log.warning "⚠️  You are running a Development Build ($addon_version)!"
        bashio::log.warning "⚠️  This version may be unstable and contain bugs."
    elif [[ "$addon_version" =~ ^0\. ]]; then
         bashio::log.info "🚧  You are running a BETA version ($addon_version)."
    fi

    bashio::log.blue "-----------------------------------------------------------"
    bashio::log.info "ℹ️  Disclaimer: Not all errors are addon-related."
    bashio::log.info "ℹ️  Some issues may originate from the software itself."
    bashio::log.blue "-----------------------------------------------------------\n"
}

print_banner

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
		echo "Cannot find certificate file $certfile . Turn off SSL or check for if the file really exists at /ssl/"
		exit 1
	fi
	if [ ! -f "/ssl/$keyfile" ]; then
		echo "Cannot find certificate key file $keyfile . Turn off SSL or check for if the file really exists at /ssl/"
		exit 1
	fi
fi

# Require mariadb service to be available
#if ! bashio::services.available "mysql"; then
#    bashio::log.error \
#        "This add-on requires the MariaDB core add-on 2.0 or newer!"
#    bashio::exit.nok \
#        "Make sure the MariaDB add-on is installed and running"
#fi

echo "This add-on requires the MariaDB core add-on 2.0 or newer!"

host=$(bashio::services "mysql" "host")
password=$(bashio::services "mysql" "password")
port=$(bashio::services "mysql" "port")
username=$(bashio::services "mysql" "username")

if [ -z "$host" ]; then
	bashio::log.warning "MariaDB not found (Mock Supervisor?). Waiting..."
	while true; do sleep 60; done
fi

#Drop database based on config flag
if bashio::config.true 'reset_database'; then
	bashio::log.warning 'Recreating database'
	echo "DROP DATABASE IF EXISTS wiki;" |
		mariadb -h "${host}" -P "${port}" -u "${username}" -p"${password}" --skip_ssl

	#Remove reset_database option
	bashio::addon.option 'reset_database'
fi

#Create Config file
echo "port: 3000" >/wiki/config.yml
echo "db:" >>/wiki/config.yml
echo "  type: mariadb" >>/wiki/config.yml
echo "  host: ${host}" >>/wiki/config.yml
echo "  port: ${port}" >>/wiki/config.yml
echo "  user: ${username}" >>/wiki/config.yml
echo "  pass: ${password}" >>/wiki/config.yml
echo "  db: wiki" >>/wiki/config.yml
echo "ssl:" >>/wiki/config.yml
echo "  enabled: ${ssl}" >>/wiki/config.yml
echo "  port: 3443" >>/wiki/config.yml
echo "  provider: custom" >>/wiki/config.yml
echo "  format: pem" >>/wiki/config.yml
echo "  key: /ssl/${keyfile}" >>/wiki/config.yml
echo "  cert: /ssl/${certfile}" >>/wiki/config.yml
echo "pool:" >>/wiki/config.yml
echo "bindIP: 0.0.0.0" >>/wiki/config.yml
echo "logLevel: ${log_level}" >>/wiki/config.yml
echo "offline: false" >>/wiki/config.yml
echo "ha: false" >>/wiki/config.yml
echo "dataPath: ./data" >>/wiki/config.yml

# Create database if not exists
echo "CREATE DATABASE IF NOT EXISTS wiki;" |
	mariadb -h "${host}" -P "${port}" -u "${username}" -p"${password}" --skip_ssl

echo "Starting Wiki.JS"
node server
