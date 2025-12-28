#!/usr/bin/with-contenv bashio
# shellcheck shell=bash

# Enable strict mode
set -e
# shellcheck disable=SC1091
source /usr/lib/bashio/banner.sh
bashio::addon.print_banner
# Get Addon Version

config_file=$(bashio::config 'config_file')
#Create Shortcut to config file
echo "Using config file from ${config_file}..."

if [ ! -f "$config_file" ]; then
	bashio::log.warning "⚠️  Wings configuration file not found at ${config_file}!"
	bashio::log.info ""
	bashio::log.info "💡 Wings needs to be configured from the Pterodactyl Panel first:"
	bashio::log.info "   1. Install & configure the Pterodactyl Panel add-on"
	bashio::log.info "   2. Create a new Node in the Panel's admin section"
	bashio::log.info "   3. Download the config.yml from the Node configuration"
	bashio::log.info ""
	bashio::log.info "📦 Panel Add-on: https://github.com/FaserF/hassio-addons/tree/master/pterodactyl-panel"
	bashio::log.info ""
	bashio::log.warning "Creating dummy config for testing purposes..."
	mkdir -p "$(dirname "$config_file")"
	touch "$config_file"
fi

mkdir -p /etc/pterodactyl
ln -sf "$config_file" /etc/pterodactyl/config.yml

echo "Starting Pterodactyl Daemon..."

exec /usr/local/bin/wings