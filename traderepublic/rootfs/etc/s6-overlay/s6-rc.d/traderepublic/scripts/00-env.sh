#!/usr/bin/with-contenv bashio
# shellcheck shell=bash

export KEEP_ALIVE_INTERVAL=$(bashio::config 'keep_alive_interval' 600)
export LOG_LEVEL=$(bashio::config 'log_level' 'info')

# Detect Home Assistant config directory (/config or /homeassistant)
HA_CONFIG_ROOT=""
for path in "/config" "/homeassistant"; do
	if [ -d "$path" ]; then
		HA_CONFIG_ROOT="$path"
		break
	fi
done

if [ -z "$HA_CONFIG_ROOT" ]; then
	HA_CONFIG_ROOT="/config"
fi
export HA_CONFIG_ROOT
export INTEGRATION_DIR="${HA_CONFIG_ROOT}/custom_components/traderepublic"

AUTO_INSTALL_INTEGRATION="true"
if bashio::config.false 'auto_install_integration'; then
	AUTO_INSTALL_INTEGRATION="false"
fi
export AUTO_INSTALL_INTEGRATION

GITHUB_TOKEN=""
if bashio::config.has_value 'github_token'; then
	GITHUB_TOKEN=$(bashio::config 'github_token')
fi
export GITHUB_TOKEN

bashio::log.info "Environment configured (KeepAlive: ${KEEP_ALIVE_INTERVAL}s, LogLevel: ${LOG_LEVEL}, HA_Config: ${HA_CONFIG_ROOT})"
