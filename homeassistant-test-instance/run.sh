#!/bin/bash
# Home Assistant Test Instance - Startup Script
# This wrapper ensures proper logging to the add-on log viewer

CONFIG_DIR="/data/homeassistant"

# Simple logging function to match HA log format
log() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') $1 $2"
}

log INFO "-----------------------------------------------------------"
log INFO " Home Assistant Test Instance"
log INFO " A standalone Home Assistant Core for testing purposes."
log INFO "-----------------------------------------------------------"
log INFO " Starting Home Assistant Core..."
log INFO " Config directory: $CONFIG_DIR"
log INFO " Web interface will be available on the configured port."
log INFO " Note: First startup may take several minutes while"
log INFO "       Home Assistant initializes the database."
log INFO "-----------------------------------------------------------"

# Ensure config directory exists
mkdir -p "$CONFIG_DIR"

# Ensure log file exists so tail doesn't fail
touch "$CONFIG_DIR/home-assistant.log"

# Stream logs to stdout in background
# Using -F to follow filename (handles rotation)
tail -n 0 -F "$CONFIG_DIR/home-assistant.log" &

# Execute Home Assistant Core
# Using exec so hass becomes PID 1 and receives signals properly
# We let HA log to file (handling rotation) and stream it via tail
exec hass -c "$CONFIG_DIR"
