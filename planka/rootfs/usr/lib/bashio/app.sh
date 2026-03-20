#!/usr/bin/env bashio
# shellcheck shell=bash
# ==============================================================================
# Bashio Custom App Library for Planka
# ==============================================================================

# ------------------------------------------------------------------------------
# Get the addon version
# ------------------------------------------------------------------------------
bashio::app.version() {
	bashio::addon.version
}

# ------------------------------------------------------------------------------
# Get the ingress entry path
# ------------------------------------------------------------------------------
bashio::app.ingress_entry() {
	# Try to get from Supervisor API directly if bashio::addon.ingress_path is missing
	local ingress_entry
	ingress_entry=$(bashio::config 'ingress_entry' 2>/dev/null)

	if bashio::var.has_value "${ingress_entry}"; then
		echo "${ingress_entry}"
	else
		# Fallback to / if not set
		echo "/"
	fi
}

# ------------------------------------------------------------------------------
# Manage App options (Mock/Wrapper)
# ------------------------------------------------------------------------------
bashio::app.option() {
	bashio::log.debug "Option '$1' requested via bashio::app.option"
}
