#!/usr/bin/with-contenv bashio
config_file=$(bashio::config 'config_file')
#Create Shortcut to config file
echo "Using config file from ${config_file}..."
ln -s $config_file /etc/pterodactyl/config.yml

echo "Starting Pterodactyl Daemon..."

exec /usr/local/bin/wings
