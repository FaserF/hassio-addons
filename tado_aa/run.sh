#!/usr/bin/with-contenv bashio
# shellcheck disable=SC1091
# shellcheck shell=bash

# Enable strict mode
set -euo pipefail



username=$(bashio::config 'username')
password=$(bashio::config 'password')
minTemp=$(bashio::config 'minTemp')
maxTemp=$(bashio::config 'maxTemp')
log_level=$(bashio::config 'log_level')

export TADO_USERNAME="${username}"
export TADO_PASSWORD="${password}"
export TADO_MIN_TEMP="${minTemp:-5}"
export TADO_MAX_TEMP="${maxTemp:-25}"

source /venv/bin/activate

echo "Starting Tado Auto Assist python script from adrianslabu/tado_aa"
if [ "$log_level" != "minimal" ]; then
	exec python3 -u /tado_aa.py
else
	exec python3 /tado_aa.py
fi
