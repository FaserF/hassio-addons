#!/usr/bin/with-contenv bashio
# shellcheck shell=bash

# Ensure s6 environment directories exist for services relying on them
mkdir -p /run/s6/container_environment
mkdir -p /var/run/s6
ln -sf /run/s6/container_environment /var/run/s6/container_environment

# Seed LOG_LEVEL if missing
if [ ! -f /run/s6/container_environment/LOG_LEVEL ]; then
    bashio::log.debug "Seeding LOG_LEVEL to info"
    echo "info" > /run/s6/container_environment/LOG_LEVEL
fi
