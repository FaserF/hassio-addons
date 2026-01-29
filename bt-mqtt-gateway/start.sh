#!/usr/bin/with-contenv bashio
# shellcheck disable=SC1091
# shellcheck shell=bash
config_path=$(bashio::config 'config_path')
DEBUG=$(bashio::config 'debug')

if ! [ -f "$config_path" ]; then
	echo "There is no $config_path file! Please have a look at the example config https://github.com/zewelor/bt-mqtt-gateway/blob/master/config.yaml.example ."
	echo "Try restarting the addon once your config file has been fully configured an been put somewhere on the HA /share folder."
	exit 1
fi

source /application/venv/bin/activate

cd /application || exit
echo "Found config file at $config_path . Copying it now."
cp "$config_path" config.yaml

# Install any missing optional dependencies based on configured workers
echo "Checking for missing optional dependencies..."
REQUIRED_PACKAGES=$(python3 ./gateway.py -r configured 2>&1)
if echo "$REQUIRED_PACKAGES" | grep -q "unsatisfied requirements"; then
	echo "Installing missing optional dependencies..."
	# Extract package names from the error message (format: The 'package==version' distribution was not found)
	PACKAGES=$(echo "$REQUIRED_PACKAGES" | grep -oP "The '[^']+' distribution was not found" | sed "s/The '\([^']*\)' distribution was not found/\1/" | tr '\n' ' ')
	if [ -n "$PACKAGES" ]; then
		echo "Installing: $PACKAGES"
		python3 -m pip install --no-cache-dir $PACKAGES
	fi
fi

echo "Huge thanks to @zewelor who is the creator of bt-mqtt-gateway - https://github.com/zewelor/bt-mqtt-gateway"
echo "If there are any bugs occurring below this line, please report it to the bt-mqtt-gateway developer and not to @FaserF - thanks."

if [ "$DEBUG" = 'true' ]; then
	echo "Start bt-mqtt gateway in debug mode"
	exec python3 ./gateway.py -d
else
	echo "Starting bt-mqtt-gateway in normal mode"
	exec python3 ./gateway.py
fi
