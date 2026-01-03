#!/bin/bash
# Home Assistant Test Instance - Startup Script
# This wrapper ensures proper logging to the add-on log viewer

CONFIG_DIR="/data/homeassistant"

echo "-----------------------------------------------------------"
echo " Home Assistant Test Instance"
echo " A standalone Home Assistant Core for testing purposes."
echo "-----------------------------------------------------------"
echo ""
echo " Starting Home Assistant Core..."
echo " Config directory: $CONFIG_DIR"
echo " Web interface will be available on the configured port."
echo ""
echo " Note: First startup may take several minutes while"
echo "       Home Assistant initializes the database."
echo "-----------------------------------------------------------"

# Ensure config directory exists
mkdir -p "$CONFIG_DIR"

# Execute Home Assistant Core
# Using exec so hass becomes PID 1 and receives signals properly
exec hass -c "$CONFIG_DIR" --log-file /proc/1/fd/1 --log-no-color
