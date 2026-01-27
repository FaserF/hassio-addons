#!/usr/bin/with-contenv bashio
# ==============================================================================
# Home Assistant Community Add-on: Vaultwarden
# Sets the log level based on the add-on configuration
# ==============================================================================
declare log_level

if bashio::config.has_value 'log_level'; then
    log_level=$(bashio::config 'log_level')
    bashio::log.info "Setting log level to ${log_level}"
else
    log_level="info"
    bashio::log.info "No log level set, defaulting to ${log_level}"
fi

# Export to s6-overlay environment
printf "%s" "${log_level}" > /run/s6/container_environment/LOG_LEVEL
