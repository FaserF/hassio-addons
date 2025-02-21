#!/usr/bin/with-contenv bashio
username=$(bashio::config 'username')
password=$(bashio::config 'password')
minTemp=$(bashio::config 'minTemp')
maxTemp=$(bashio::config 'maxTemp')
log_level=$(bashio::config 'log_level')

sed -i "s/your_tado_username/${username}/" /tado_aa.py
sed -i "s/your_tado_password/${password}/" /tado_aa.py
sed -i "s/5/${minTemp}/" /tado_aa.py
sed -i "s/25/${maxTemp}/" /tado_aa.py

source ./venv/bin/activate

echo "Starting Tado Auto Assist python script from adrianslabu/tado_aa"
if [ $log_level != "minimal" ]; then
	python3 -u /tado_aa.py
else
	python3 /tado_aa.py
fi
