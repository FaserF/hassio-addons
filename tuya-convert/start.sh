#!/usr/bin/env bashio
# shellcheck disable=SC2034,SC2129,SC2016
backup_path=$(bashio::config 'backup_path')
selection=$(bashio::config 'firmware')
accept_eula=$(bashio::config 'accept_eula')

touch config.txt
#echo WLAN=wlan0 >config.txt
echo "AP=vtrust-flash" >>config.txt
echo "GATEWAY=10.42.42.1" >>config.txt
echo "LOCALBACKUPDIR=$backup_path" >>config.txt
echo "selection=$selection" >>config.txt
echo "backupfolder=$backup_path" >>config.txt

if [ "$accept_eula" = "true" ]; then
	echo "EULA was accepted - starting script"
	touch ./scripts/eula_accepted
	ls -l
	exec ./start_flash.sh
else
	echo "EULA wasnt accepted. Exiting. You can find the EULA here: https://github.com/ct-Open-Source/tuya-convert/blob/master/scripts/setup_checks.sh#L18"
	exit
fi

echo "Addon will now be stopped. If you want to flash another one, be sure to restart the addon."
echo "======================================================"
