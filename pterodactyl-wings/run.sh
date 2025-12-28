#!/usr/bin/with-contenv bashio
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


ln -s "$config_file" /etc/pterodactyl/config.yml

echo "Starting Pterodactyl Daemon..."

exec /usr/local/bin/wings
