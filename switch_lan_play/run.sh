#!/usr/bin/env bashio

# Enable strict mode
set -e
# shellcheck disable=SC1091


#VARIABLES
server=$(bashio::config 'server')
log_level=$(bashio::config 'log_level' || echo "info")

# Helpful hint for self-hosting
bashio::log.info "💡 Tip: Want to host your own server instead of using public ones?"
bashio::log.info "   Check out the Switch LAN Play Server add-on:"
bashio::log.info "   https://github.com/FaserF/hassio-addons/tree/master/switch_lan_play_server"
bashio::log.info ""

echo "For more informations or bugs with lan-play itself please visit: https://github.com/spacemeowx2/switch-lan-play"
echo "If you want to install the latest lan-play client, please reinstall this addon"
echo "Starting lan-play Client with the server: $server - To Connect your switch with this client have a look at https://github.com/spacemeowx2/switch-lan-play#2-switch"

# Build command arguments
LAN_PLAY_ARGS=("--relay-server-addr" "$server")

# Ensure stdout and stderr are unbuffered
export PYTHONUNBUFFERED=1

# Use exec to replace shell process with lan-play
# If log level is not debug, filter out [DEBUG]: lines
if [ "$log_level" = "debug" ]; then
    bashio::log.info "Debug logging enabled - all debug messages will be shown"
    # Show all output including debug
    exec /usr/local/bin/lan-play "${LAN_PLAY_ARGS[@]}" 2>&1
else
    bashio::log.info "Info logging enabled - debug messages will be filtered"
    # Filter out [DEBUG]: lines
    # Note: grep becomes the main process, but healthcheck still works as it checks for lan-play process
    exec /usr/local/bin/lan-play "${LAN_PLAY_ARGS[@]}" 2>&1 | grep -v "^\[DEBUG\]:"
fi
