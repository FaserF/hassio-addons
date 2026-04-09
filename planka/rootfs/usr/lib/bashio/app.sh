#!/usr/bin/env bashio
# shellcheck shell=bash
# ==============================================================================
# Shared Bashio App Library
# Provides standardized helpers for addon management
# ==============================================================================

# ------------------------------------------------------------------------------
# Set an addon option via Supervisor API
# ------------------------------------------------------------------------------
bashio::app.option() {
	local option=$1
	local value=${2:-false} # Default to false if not provided

	bashio::log.info "Requesting Supervisor to set option '$option' to '$value'..."

	# Fetch current options from /data/options.json (most robust source)
	if [ ! -f "/data/options.json" ]; then
		bashio::log.error "Could not find /data/options.json. Option update failed."
		return 1
	fi

	local options
	options=$(cat /data/options.json)

	local new_options
	# Use jq to update the specific key. Handle both boolean and string values safely.
	if [[ "$value" == "true" ]] || [[ "$value" == "false" ]]; then
		new_options=$(echo "$options" | jq -c ".${option} = ${value}" 2>/dev/null)
	else
		new_options=$(echo "$options" | jq -c ".${option} = \"${value}\"" 2>/dev/null)
	fi

	if [ -n "$new_options" ]; then
		if bashio::api.supervisor "POST" "/addons/self/options" "{\"options\": ${new_options}}"; then
			bashio::log.info "Option '$option' successfully updated to '$value'."
			return 0
		else
			bashio::log.error "Supervisor API rejected the option update."
			return 1
		fi
	else
		bashio::log.error "Failed to process options with jq. Ensure jq is installed in the addon image."
		return 1
	fi
}

# ------------------------------------------------------------------------------
# Get the ingress entry point
# ------------------------------------------------------------------------------
bashio::app.ingress_entry() {
    bashio::addon.ingress_entry "$@"
}

# ------------------------------------------------------------------------------
# Get the ingress port
# ------------------------------------------------------------------------------
bashio::app.ingress_port() {
    bashio::addon.ingress_port "$@"
}

# ------------------------------------------------------------------------------
# Get the app version
# ------------------------------------------------------------------------------
bashio::app.version() {
    bashio::addon.version "$@"
}
