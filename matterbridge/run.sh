#!/usr/bin/with-contenv bashio
# shellcheck shell=bash

# Enable strict mode
set -e
# shellcheck disable=SC1091

bashio::addon.print_banner
# banner prints addon version

config_path=$(bashio::config 'config_path')
log_level=$(bashio::config 'log_level')

if ! [ -f "$config_path" ]; then
	echo "There is no $config_path file! Please create one for your needs! See here for an example: https://github.com/42wim/matterbridge/blob/master/matterbridge.toml.sample"
	echo "Try restarting the addon once your config file has been fully configured an been put somewhere on the HA /share folder."
	exit 1
fi
echo "Found config file at $config_path . Copying it now."
cp "$config_path" /etc/matterbridge/matterbridge.toml

parameter="-conf /etc/matterbridge/matterbridge.toml"
if [ "$log_level" = "debug" ]; then
	parameter="${parameter} -debug"
fi
echo "" >/var/log/matterbridge.log

echo "Starting Matterbridge..."
# SC2086: We want word splitting here for parameters, so we can't double quote "parameter"
# unless we use an array, but simplicity suggests checking if we can just disable the check
# or use array. Let's use array.
params=("-conf" "/etc/matterbridge/matterbridge.toml")
if [ "$log_level" = "debug" ]; then
	params+=("-debug")
fi

exec /bin/matterbridge "${params[@]}" &
exec tail -f /var/log/matterbridge.log
