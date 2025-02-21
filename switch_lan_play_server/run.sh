#!/usr/bin/env bashio

#VARIABLES
username=$(bashio::config 'username')
password=$(bashio::config 'password')

echo "For more informations or bugs with lan-play itself please visit: https://github.com/spacemeowx2/switch-lan-play"

echo "Starting lan-play server - To Connect your switch with this server have a look at https://github.com/spacemeowx2/switch-lan-play#2-switch"
cd switch-lan-play/server
if [ ! -z "$username" ] && [ ! -z "$password" ] && [ ! $username = "null" ] && [ ! $password = "null" ]; then
	npm start --simpleAuth $username:$password
else
	echo "No username and/or password was provided. Using no authentification to connect to this Server."
	npm start
fi
