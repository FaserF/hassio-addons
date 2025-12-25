#!/usr/bin/with-contenv bashio
# shellcheck shell=bash
config_file=$(bashio::config 'config_file')
#Create Shortcut to config file
echo "Using config file from ${config_file}..."

if [ ! -f "$config_file" ]; then
    echo "Config file not found at ${config_file}"
    echo "Creating dummy config for testing purposes..."
    mkdir -p "$(dirname "$config_file")"
    touch "$config_file"
fi

ln -s "$config_file" /etc/pterodactyl/config.yml

echo "Starting Pterodactyl Daemon..."

exec /usr/local/bin/wings
