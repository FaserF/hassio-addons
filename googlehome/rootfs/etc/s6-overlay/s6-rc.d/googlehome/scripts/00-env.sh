#!/usr/bin/with-contenv bashio
# shellcheck shell=bash
export LOG_LEVEL="$(bashio::config 'log_level' 'info')"
export AUTO_INSTALL_INTEGRATION="$(bashio::config 'auto_install_integration' 'true')"
export GITHUB_TOKEN="$(bashio::config 'github_token' '')"
export HA_CONFIG_ROOT="/config"
