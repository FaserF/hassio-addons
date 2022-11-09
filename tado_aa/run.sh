#!/usr/bin/with-contenv bashio
username=$(bashio::config 'username')
password=$(bashio::config 'password')

sed -i "s/your_username@mail.com/${username}/" tado_aa.py
sed -i "s/your_password/${password}/" tado_aa.py

echo "Starting Tado Auto Assist python script from adrianslabu/tado_aa"
python3 tado_aa.py
