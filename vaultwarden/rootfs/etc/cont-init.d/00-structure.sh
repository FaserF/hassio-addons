#!/usr/bin/with-contenv bashio
# ==============================================================================
# Home Assistant Community Add-on: Vaultwarden
# Ensure s6 environment structure exists before services start
# ==============================================================================
mkdir -p /var/run/s6/container_environment
