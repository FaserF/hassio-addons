#!/bin/sh

config_path=/share/bt-mqtt-gateway.yaml
DEBUG=false
#config_path=$(bashio::config 'config_path')
#DEBUG=$(bashio::config 'debug')

if ! [ -f $config_path ]; then
    echo "There is no $config_path file! Please edit /share/bt-mqtt-gateway.yaml.example and rename it afterwards."
    echo "Do edit it before restarting!!!!!!!"
    cp /application/config.yaml.example /share/bt-mqtt-gateway.yaml.example
    exit 1
fi

echo "Found config file at $config_path . Copying it now."
cp $config_path /config.yaml

cd /application
if [ "$DEBUG" = 'true' ]; then
    echo "Start bt-mqtt gateway in debug mode"
    python3 ./gateway.py -d
    status=$?
    echo "Gateway died..."
    exit $status
else
    echo "Starting bt-mqtt gateway in normal mode"
    echo "If there are any bugs occuring below this line, please report it to the bt-mqtt-gateway developer and not to @FaserF - thanks."
    python3 ./gateway.py
fi
