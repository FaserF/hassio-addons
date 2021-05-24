#!/usr/bin/env bashio

#VARIABLES
server=$(bashio::config 'server')

echo "for more informations or bugs with lan-play itself please visit: https://github.com/spacemeowx2/switch-lan-play"

if [ ! -f /data/lan-play ]; then
    echo "Downloading latest lan-play"
    git clone https://github.com/spacemeowx2/switch-lan-play.git
    cd switch-lan-play
    mkdir build
    cd build
    echo "Compiling latest lan-play client for this linux architecture"
    echo "This may take a while...."
    cmake .. >/dev/null 2>&1
    make >/dev/null 2>&1
    echo "Moving compiled file into place and setting permissions"
    cd src
    chmod +x lan-play
    cp lan-play /data/
else
    echo "Lan-play client is already compiled and installed."
    echo "If you want to install the latest lan-play client, please reinstall this addon"
fi

echo "Starting lan-play Client with the server: $server"
echo "To Connect your switch with this client have a look at https://github.com/spacemeowx2/switch-lan-play#2-switch"
./data/lan-play --relay-server-addr $server