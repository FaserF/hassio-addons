#!/usr/bin/with-contenv bashio
# shellcheck disable=SC1091
# shellcheck shell=bash
username=$(bashio::config 'username')
password=$(bashio::config 'password')
minTemp=$(bashio::config 'minTemp')
maxTemp=$(bashio::config 'maxTemp')
log_level=$(bashio::config 'log_level')

export TADO_USERNAME="${username}"
export TADO_PASSWORD="${password}"
export TADO_MIN_TEMP="${minTemp}"
export TADO_MAX_TEMP="${maxTemp}"

source ./venv/bin/activate

echo "Starting Tado Auto Assist python script from adrianslabu/tado_aa"
if [ "$log_level" != "minimal" ]; then
	python3 -u /tado_aa.py
else
	python3 /tado_aa.py
fi
