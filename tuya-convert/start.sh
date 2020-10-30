#!/usr/bin/env bashio
backup_path=$(bashio::config 'backup_path')
selection=$(bashio::config 'firmware')
accept_eula=$(bashio::config 'accept_eula')

echo "Downloading files from github.... wait a few minutes"
git clone https://github.com/ct-Open-Source/tuya-convert
cd tuya-convert

bold=$(tput -T bold)
normal=$(tput -T sgr0)
. ./config.txt

setup () {
	echo "tuya-convert $(git describe --tags)"
	pushd scripts >/dev/null || exit
	if [ "$accept_eula" = "true" ]; then
		echo "EULA was accpeted - starting setup_checks script"
		touch scripts/eula_accepted
		. ./setup_checks.sh
	else
		echo "EULA wasnt accepted. Exiting. You can find the EULA here: https://github.com/ct-Open-Source/tuya-convert/blob/master/scripts/setup_checks.sh#L18"
		exit
	fi
	screen_minor=$(screen --version | cut -d . -f 2)
	if [ "$screen_minor" -gt 5 ]; then
		screen_with_log="sudo screen -L -Logfile"
	elif [ "$screen_minor" -eq 5 ]; then
		screen_with_log="sudo screen -L"
	else
		screen_with_log="sudo screen -L -t"
	fi
	echo "======================================================"
	echo -n "  Starting AP in a screen"
	$screen_with_log smarthack-wifi.log -S smarthack-wifi -m -d ./setup_ap.sh
	while ! ping -c 1 -W 1 -n "$GATEWAY" &> /dev/null; do
		printf .
	done
	echo
	sleep 5
	echo "  Starting web server in a screen"
	$screen_with_log smarthack-web.log -S smarthack-web -m -d ./fake-registration-server.py
	echo "  Starting Mosquitto in a screen"
	$screen_with_log smarthack-mqtt.log -S smarthack-mqtt -m -d mosquitto -v
	echo "  Starting PSK frontend in a screen"
	$screen_with_log smarthack-psk.log -S smarthack-psk -m -d ./psk-frontend.py -v
	echo "  Starting Tuya Discovery in a screen"
	$screen_with_log smarthack-udp.log -S smarthack-udp -m -d ./tuya-discovery.py
	echo
}

cleanup () {
	echo "======================================================"
	echo "Cleaning up..."
	sudo screen -S smarthack-web          -X stuff '^C'
	sudo screen -S smarthack-mqtt         -X stuff '^C'
	sudo screen -S smarthack-psk          -X stuff '^C'
	sudo screen -S smarthack-udp          -X stuff '^C'
	echo "Closing AP"
	sudo pkill hostapd
	echo "Exiting..."
	popd >/dev/null || exit
}

trap cleanup EXIT
setup

while true; do
	echo "======================================================"
	echo
	echo "IMPORTANT"
	echo "1. Connect any other device (a smartphone or something) to the WIFI $AP"
	echo "   This step is IMPORTANT otherwise the smartconfig may not work!"
	echo "2. Put your IoT device in autoconfig/smartconfig/pairing mode (LED will blink fast). This is usually done by pressing and holding the primary button of the device"
	echo "   Make sure nothing else is plugged into your IoT device while attempting to flash."
	echo "3. Waiting 30 seconds before continuing"
    sleep 30
	echo
	echo "======================================================"

	echo "Starting smart config pairing procedure"
	./smartconfig/main.py &

	echo "Waiting for the device to install the intermediate firmware"

	i=120
	# !!! IMPORTANT !!!
	# Did your device get an IP address other than 10.42.42.42?
	# That is because it is not running the intermediate firmware
	# The intermediate firmware will request 10.42.42.42
	# Do NOT change this address!!!
	# It will NOT make it install and will break this script
	while ! ping -c 1 -W 1 -n 10.42.42.42 &> /dev/null; do
		printf .
		if (( --i == 0 )); then
			echo
			echo "Device did not appear with the intermediate firmware"
			echo "Check the *.log files in the scripts folder"
			pkill -f smartconfig/main.py && echo "Stopping smart config"
			break 2
			continue 2
		fi
	done

	echo
	echo "IoT-device is online with ip 10.42.42.42"

	pkill -f smartconfig/main.py && echo "Stopping smart config"

	echo "Fetching firmware backup"
	sleep 2
	timestamp=$(date +%Y%m%d_%H%M%S)
	backupfolder="$backup_path/$timestamp"
	mkdir -p "$backupfolder"
	pushd "$backupfolder" >/dev/null || exit

	if ! curl -JOm 90 http://10.42.42.42/backup; then
		echo "Could not fetch a complete backup"
		break
		sleep 2
	fi

	echo "======================================================"
	echo "Getting Info from IoT-device"
	curl -s http://10.42.42.42 | tee device-info.txt
	popd >/dev/null || exit

	echo "======================================================"
	echo "Ready to flash third party firmware!"
	echo
	echo "For your convenience, the following firmware images are already included in this repository:"
	echo "  Tasmota v8.1.0.2 (wifiman)"
	echo "  ESPurna 1.13.5 (base)"
	echo
	echo "Please ensure the firmware fits the device and includes the bootloader"
	echo "MAXIMUM SIZE IS 512KB"
	echo "Waiting another 30 seconds, so you can be sure that your device will be flashed now and could be bricked!!!!!!"
	sleep 30

	MAGIC=$(printf "\xe9")
	

	echo "Attempting to flash $selection, this may take a few seconds..."
	RESULT=$(curl -s "http://10.42.42.42/flash?url=http://10.42.42.1/files/$selection") ||
	echo "Could not reach the device!"

	echo "$RESULT"
	if [[ "$RESULT" =~ failed || -z "$RESULT" ]]; then
		echo "something did not work as expected"
		break
	else
		if [[ "$selection" == "tasmota.bin" ]]; then
			echo "Look for a tasmota-xxxx SSID to which you can connect and configure"
			echo "Be sure to configure your device for proper function!"
		elif [[ "$selection" == "espurna.bin" ]]; then
			echo "Look for an ESPURNA-XXXXXX SSID to which you can connect and configure"
			echo "Default password is \"fibonacci\""
			echo "Be sure to upgrade to your device specific firmware for proper function!"
		fi
		echo
		echo "HAVE FUN!"
		sudo mv *.log "$backupfolder/"
		echo "Addon will now be stopped. If you want to flash another one, be sure to restart the addon."
		echo "======================================================"
		break
	fi
done