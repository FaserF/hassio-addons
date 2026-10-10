#!/usr/bin/with-contenv bashio

set -e

bashio::log.info "Starting Epic Games Freebies Claimer..."

# Read options from config
AUTO_CLAIM=$(bashio::config 'auto_claim')
CRON_SCHEDULE=$(bashio::config 'cron_schedule')
LOG_LEVEL=$(bashio::config 'log_level')

export AUTO_CLAIM
export CRON_SCHEDULE
export LOG_LEVEL

# Ensure data directory exists
mkdir -p /data
if [ ! -f /data/session.json ]; then
    echo "{}" > /data/session.json
fi
if [ ! -f /data/config.json ]; then
    echo "{}" > /data/config.json
fi

bashio::log.info "Running epic_server.py"
python3 /usr/bin/epic_server.py
