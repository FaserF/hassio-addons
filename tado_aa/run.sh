#!/usr/bin/with-contenv bashio
# shellcheck disable=SC1091
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

username=$(bashio::config 'username')
password=$(bashio::config 'password')
minTemp=$(bashio::config 'minTemp')
maxTemp=$(bashio::config 'maxTemp')
log_level=$(bashio::config 'log_level')

export TADO_USERNAME="${username}"
export TADO_PASSWORD="${password}"
export TADO_MIN_TEMP="${minTemp:-5}"
export TADO_MAX_TEMP="${maxTemp:-25}"

source ./venv/bin/activate

echo "Starting Tado Auto Assist python script from adrianslabu/tado_aa"
if [ "$log_level" != "minimal" ]; then
	python3 -u /tado_aa.py
else
	python3 /tado_aa.py
fi
