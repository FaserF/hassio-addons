#!/usr/bin/env bashio

#VARIABLES
server=$(bashio::config 'server')

echo "For more informations or bugs with lan-play itself please visit: https://github.com/spacemeowx2/switch-lan-play"
echo "If you want to install the latest lan-play client, please reinstall this addon"
echo "Starting lan-play Client with the server: $server - To Connect your switch with this client have a look at https://github.com/spacemeowx2/switch-lan-play#2-switch"
./lan-play --relay-server-addr $server
