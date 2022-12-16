#!/usr/bin/with-contenv bashio
config_path=$(bashio::config 'config_path')

if ! [ -f $config_path ]; then
	echo "There is no $config_path file! Please create one for your needs! See here for an example: https://github.com/42wim/matterbridge/blob/master/matterbridge.toml.sample"
	echo "Try restarting the addon once your config file has been fully configured an been put somewhere on the HA /share folder."
	exit 1
fi
echo "Found config file at $config_path . Copying it now."
cp $config_path /etc/matterbridge/matterbridge.toml

echo "" > /var/log/matterbridge.log

echo "Starting Matterbridge..."
exec /bin/matterbridge -conf /etc/matterbridge/matterbridge.toml
sleep 3
exec tail -f /var/log/matterbridge.log