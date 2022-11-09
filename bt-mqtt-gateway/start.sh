#!/usr/bin/with-contenv bashio

#config_path=/share/bt-mqtt-gateway.yaml
#debug_path=/share/bt-mqtt-gateway-debug.txt
#DEBUG=false
config_path=$(bashio::config 'config_path')
DEBUG=$(bashio::config 'debug')

if ! [ -f $config_path ]; then
	echo "There is no $config_path file! Please have a look at the example config https://github.com/zewelor/bt-mqtt-gateway/blob/master/config.yaml.example ."
	echo "Try restarting the addon once your config file has been fully configured an been put somewhere on the HA /share folder."
	exit 1
fi

cd /application
echo "Found config file at $config_path . Copying it now."
cp $config_path config.yaml

if [ "$DEBUG" = 'true' ]; then
	echo "Start bt-mqtt gateway in debug mode"
	python3 ./gateway.py -d
	status=$?
	echo "Gateway died..."
	exit $status
else
	echo "Starting bt-mqtt-gateway in normal mode"
	echo "Huge thanks to @zewelor who is the creator of bt-mqtt-gateway - https://github.com/zewelor/bt-mqtt-gateway"
	echo "If there are any bugs occurring below this line, please report it to the bt-mqtt-gateway developer and not to @FaserF - thanks."
	python3 ./gateway.py
fi
