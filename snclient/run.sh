#!/usr/bin/with-contenv bashio
config_path=$(bashio::config 'config_path')

if ! [ -f $config_path ]; then
	echo "There is no $config_path file! Please create one for your needs!"
	echo "Try restarting the addon once your config file has been fully configured an been put somewhere on the HA /share folder."
	exit 1
fi
echo "Found config file at $config_path . Copying it now."
cp $config_path /etc/snclient/snclient_local.ini

echo "Starting SNClient..."
exec snclient server
echo "SNClien started"
exec tail -f /var/log/snclient/snclient.log