#!/usr/bin/with-contenv bashio
# shellcheck disable=SC1091,SC2155
# shellcheck shell=bash

export KEEP_ALIVE_INTERVAL=$(bashio::config 'keep_alive_interval' 600)
export CACHE_RETENTION_HOURS=$(bashio::config 'cache_retention_hours' 12)
if ! LOG_LEVEL=$(bashio::config 'log_level') || [ -z "$LOG_LEVEL" ]; then
	bashio::log.warning "Failed to fetch log_level configuration. Using default: info"
	LOG_LEVEL="info"
fi
bashio::log.level "${LOG_LEVEL}"
export LOG_LEVEL

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
