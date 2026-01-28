#!/usr/bin/env bash
# Disable strict mode
set +u

# Ensure s6 environment structure exists
# This fixes the base-addon-log-level crash
mkdir -p /var/run/s6/container_environment
mkdir -p /run/s6/container_environment

# Set a default LOG_LEVEL file to prevent unbound variable errors in base image
if [ ! -f "/var/run/s6/container_environment/LOG_LEVEL" ]; then
    echo "info" > /var/run/s6/container_environment/LOG_LEVEL
fi
