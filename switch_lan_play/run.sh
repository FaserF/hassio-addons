#!/usr/bin/env bashio


# Enable strict mode
set -e

# Get Addon Version
addon_version=$(bashio::addon.version)

# Banner Function
print_banner() {
    bashio::log.blue " \n"
    bashio::log.blue "-----------------------------------------------------------"
    bashio::log.blue " 📦 FaserF's Addon Repository"
    bashio::log.blue " 🔗 GitHub: https://github.com/FaserF/hassio-addons"
    bashio::log.blue "-----------------------------------------------------------\n"

    # Version Checks
    if [[ "$addon_version" == *"dev"* ]]; then
        bashio::log.warning "⚠️  You are running a Development Build ($addon_version)!"
        bashio::log.warning "⚠️  This version may be unstable and contain bugs."
    elif [[ "$addon_version" =~ ^0\. ]]; then
         bashio::log.info "🚧  You are running a BETA version ($addon_version)."
    fi

    bashio::log.blue "-----------------------------------------------------------"
    bashio::log.info "ℹ️  Disclaimer: Not all errors are addon-related."
    bashio::log.info "ℹ️  Some issues may originate from the software itself."
    bashio::log.blue "-----------------------------------------------------------\n"
}

print_banner

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
./lan-play --relay-server-addr "$server"
