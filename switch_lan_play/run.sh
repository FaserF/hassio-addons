#!/usr/bin/env bashio

# Enable strict mode
set -e
# shellcheck disable=SC1091


#VARIABLES
server=$(bashio::config 'server')

# Helpful hint for self-hosting
bashio::log.info "💡 Tip: Want to host your own server instead of using public ones?"
bashio::log.info "   Check out the Switch LAN Play Server add-on:"
bashio::log.info "   https://github.com/FaserF/hassio-addons/tree/master/switch_lan_play_server"
bashio::log.info ""

echo "For more informations or bugs with lan-play itself please visit: https://github.com/spacemeowx2/switch-lan-play"
echo "If you want to install the latest lan-play client, please reinstall this addon"
echo "Starting lan-play Client with the server: $server - To Connect your switch with this client have a look at https://github.com/spacemeowx2/switch-lan-play#2-switch"
/usr/local/bin/lan-play --relay-server-addr "$server"
