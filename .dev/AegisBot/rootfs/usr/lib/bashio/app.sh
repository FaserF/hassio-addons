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

# <TEMP_MIGRATION_HELPER:REMOVE_ON_RELEASE>
# ------------------------------------------------------------------------------
# Automatic Cross-Channel Data Migration (Stable -> Dev / Edge)
# ------------------------------------------------------------------------------
bashio::app.auto_migrate_data() {
	local app_slug=$1
	local share_backup="/share/.migration_backup/${app_slug}"

	if [ -d "/share" ]; then
		mkdir -p "$share_backup"
		# Auto-restore if /data has no databases/keys yet
		if [ -d "$share_backup" ] && [ -z "$(ls -A /data 2>/dev/null | grep -E '\.db|\.sqlite|database|\.secret_key|sessions')" ]; then
			if [ -n "$(ls -A "$share_backup" 2>/dev/null)" ]; then
				bashio::log.info "📦 Detected existing data from previous channel installation in /share! Auto-migrating..."
				cp -rn "$share_backup"/* /data/ 2>/dev/null || true
				bashio::log.info "✅ Data successfully restored into /data."
			fi
		fi

		# Keep migration backup up to date
		if [ -d "/data" ]; then
			for f in /data/*.db /data/*.sqlite /data/*.sqlite3 /data/.*secret* /data/*.key; do
				if [ -e "$f" ]; then
					cp -u "$f" "$share_backup/" 2>/dev/null || true
				fi
			done
			if [ -d "/data/sessions" ]; then
				mkdir -p "$share_backup/sessions"
				cp -ru /data/sessions/* "$share_backup/sessions/" 2>/dev/null || true
			fi
		fi
	fi
}
# </TEMP_MIGRATION_HELPER:REMOVE_ON_RELEASE>

