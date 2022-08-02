#!/usr/bin/env bashio
config_file=$(bashio::config 'config_file')
update_time_in_seconds=$(bashio::config 'update_time_in_seconds')

if [ ! -f $config_file ]; then
	echo "Seems there is no config file at $config_file"
	echo "Check the path again. Exiting script now"
	exit 1
fi

fdu update $config_file

echo "Starting FDU every $update_time_in_seconds with the config file $config_file"

fdu process -c -i -r -t $update_time_in_seconds $config_file
