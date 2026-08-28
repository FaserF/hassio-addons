#!/usr/bin/with-contenv bashio
# shellcheck disable=SC1091
# shellcheck shell=bash

# Load build-time env vars (BAILEYS_VERSION, FASTAPI_VERSION, etc.) into this shell

# shellcheck disable=SC1091
if [ -f /etc/environment ]; then
	source /etc/environment 2>/dev/null || true
	# Re-export so they are available as process env vars for Node.js
	[ -n "${BAILEYS_VERSION:-}" ] && export BAILEYS_VERSION
	[ -n "${EXPRESS_VERSION:-}" ] && export EXPRESS_VERSION
	[ -n "${ALPINE_VERSION:-}" ] && export ALPINE_VERSION
fi

# Detect Addon / Server version
ADDON_VER=""
if ! ADDON_VER=$(bashio::app.version 2>/dev/null); then
	if ! ADDON_VER=$(bashio::addon.version 2>/dev/null); then
		ADDON_VER="${APP_VERSION:-unknown}"
	fi
fi
export ADDON_VERSION="${ADDON_VER:-unknown}"
export SERVER_VERSION="${ADDON_VER:-unknown}"

bashio::log.info "Starting WhatsApp Home Assistant App (Baileys)..."

export PORT=8066

# Get or generate API Key
API_KEY=""
if [ -f "/data/.api_token" ]; then
	API_KEY=$(cat /data/.api_token)
elif [ -f "/data/api_token.txt" ]; then
	API_KEY=$(cat /data/api_token.txt)
	if [ -n "$API_KEY" ]; then
		echo -n "$API_KEY" >/data/.api_token
		rm -f /data/api_token.txt
		bashio::log.info "Migrated API key from /data/api_token.txt to /data/.api_token"
	fi
fi

bashio::log.debug "Active shell options: $-"

if [ -z "$API_KEY" ]; then
	bashio::log.debug "No API key found. Generating random API token..."
	set +o pipefail
	API_KEY=$(tr -dc 'a-zA-Z0-9' </dev/urandom | head -c 32)
	set -o pipefail
	bashio::log.debug "Successfully generated random API token. Saving to /data/.api_token..."
	echo -n "$API_KEY" >/data/.api_token
fi
export API_TOKEN="$API_KEY"
# Map Bashio log level to Pino log level (used by Baileys/WhatsApp)
if ! LOG_LEVEL=$(bashio::config 'log_level') || [ -z "$LOG_LEVEL" ]; then
	bashio::log.warning "Failed to fetch log_level configuration. Using default: info"
	LOG_LEVEL="info"
fi
case "${LOG_LEVEL}" in
trace) LOG_LEVEL="silly" ;;
debug) LOG_LEVEL="debug" ;;
info | notice) LOG_LEVEL="info" ;;
warning | warn) LOG_LEVEL="warn" ;;
error | fatal) LOG_LEVEL="error" ;;
*) LOG_LEVEL="info" ;;
esac
export LOG_LEVEL
if bashio::config.true 'reset_session'; then
	bashio::log.warning "⚠️  RESET_SESSION toggle is ENABLED."
	bashio::log.warning "Clearing authentication data in /data/auth_info_baileys..."
	rm -rf /data/auth_info_baileys
	export RESET_SESSION="true"
else
	export RESET_SESSION="false"
fi

# Send Message Timeout (Default 25s)
if ! SEND_MESSAGE_TIMEOUT=$(bashio::config 'send_message_timeout') || [ -z "$SEND_MESSAGE_TIMEOUT" ]; then
	SEND_MESSAGE_TIMEOUT=25000
fi
export SEND_MESSAGE_TIMEOUT

# Keep Alive Interval (Default 30s)
if ! KEEP_ALIVE_INTERVAL=$(bashio::config 'keep_alive_interval') || [ -z "$KEEP_ALIVE_INTERVAL" ]; then
	KEEP_ALIVE_INTERVAL=30000
fi
export KEEP_ALIVE_INTERVAL

# Mask Sensitive Data (Default false)
if bashio::config.true 'mask_sensitive_data'; then
	export MASK_SENSITIVE_DATA="true"
else
	export MASK_SENSITIVE_DATA="false"
fi

# Webhook Configuration
if bashio::config.true 'webhook_enabled'; then
	export WEBHOOK_ENABLED="true"
else
	export WEBHOOK_ENABLED="false"
fi

if ! WEBHOOK_URL=$(bashio::config 'webhook_url') || [ "$WEBHOOK_URL" = "null" ] || [ -z "$WEBHOOK_URL" ]; then
	WEBHOOK_URL=""
fi
export WEBHOOK_URL

if ! WEBHOOK_TOKEN=$(bashio::config 'webhook_token') || [ "$WEBHOOK_TOKEN" = "null" ] || [ -z "$WEBHOOK_TOKEN" ]; then
	WEBHOOK_TOKEN=""
fi
export WEBHOOK_TOKEN

# UI Authentication
if bashio::config.true 'ui_auth_enabled'; then
	export UI_AUTH_ENABLED="true"
else
	export UI_AUTH_ENABLED="false"
fi

if ! UI_AUTH_PASSWORD=$(bashio::config 'ui_auth_password') || [ "$UI_AUTH_PASSWORD" = "null" ] || [ -z "$UI_AUTH_PASSWORD" ]; then
	UI_AUTH_PASSWORD=""
fi
export UI_AUTH_PASSWORD

# Mark Online (Default false)
if bashio::config.true 'mark_online'; then
	export MARK_ONLINE="true"
else
	export MARK_ONLINE="false"
fi

# Sync Full History (Default false)
if bashio::config.true 'sync_full_history'; then
	export SYNC_FULL_HISTORY="true"
else
	export SYNC_FULL_HISTORY="false"
fi

# Admin Notifications (Default true)
if bashio::config.false 'admin_notifications_enabled'; then
	export ADMIN_NOTIFICATIONS_ENABLED="false"
else
	export ADMIN_NOTIFICATIONS_ENABLED="true"
fi

# Welcome Message (Default true)
if bashio::config.false 'welcome_message_enabled'; then
	export WELCOME_MESSAGE_ENABLED="false"
else
	export WELCOME_MESSAGE_ENABLED="true"
fi

# Media Folder (Default null)
if ! MEDIA_FOLDER=$(bashio::config 'media_folder') || [ -z "$MEDIA_FOLDER" ]; then
	MEDIA_FOLDER="null"
fi

# New Rate Limiting & Fetch Options
if ! MESSAGE_SEND_INTERVAL=$(bashio::config 'message_send_interval') || [ -z "$MESSAGE_SEND_INTERVAL" ]; then
	MESSAGE_SEND_INTERVAL=1000
fi
export MESSAGE_SEND_INTERVAL

if ! GROUP_FETCH_INTERVAL=$(bashio::config 'group_fetch_interval') || [ -z "$GROUP_FETCH_INTERVAL" ]; then
	GROUP_FETCH_INTERVAL=300000
fi
export GROUP_FETCH_INTERVAL

if ! GROUP_FETCH_COOLDOWN_ON_ERROR=$(bashio::config 'group_fetch_cooldown_on_error') || [ -z "$GROUP_FETCH_COOLDOWN_ON_ERROR" ]; then
	GROUP_FETCH_COOLDOWN_ON_ERROR=60000
fi
export GROUP_FETCH_COOLDOWN_ON_ERROR

if ! GROUP_FETCH_COOLDOWN_ON_RATE_LIMIT=$(bashio::config 'group_fetch_cooldown_on_rate_limit') || [ -z "$GROUP_FETCH_COOLDOWN_ON_RATE_LIMIT" ]; then
	GROUP_FETCH_COOLDOWN_ON_RATE_LIMIT=900000
fi
export GROUP_FETCH_COOLDOWN_ON_RATE_LIMIT

# Reject Unauthorized Certificates (Default true)
if bashio::config.false 'reject_unauthorized'; then
	export NODE_TLS_REJECT_UNAUTHORIZED="0"
else
	export NODE_TLS_REJECT_UNAUTHORIZED="1"
fi

if [ "$MEDIA_FOLDER" != "null" ]; then
	bashio::log.info "Validating media folder: ${MEDIA_FOLDER}..."
	if ! mkdir -p "$MEDIA_FOLDER"; then
		bashio::log.error "Failed to create media folder: ${MEDIA_FOLDER}. Check permissions."
	else
		bashio::log.info "✅ Media folder ready."
		export MEDIA_FOLDER
	fi
fi

# Detect Home Assistant config directory
HA_CONFIG_ROOT=""
for path in "/config" "/homeassistant"; do
	if [ -d "$path" ]; then
		HA_CONFIG_ROOT="$path"
		break
	fi
done

if [ -z "$HA_CONFIG_ROOT" ]; then
	bashio::log.error "Could not find Home Assistant configuration directory in /config or /homeassistant"
	# Fallback to /config and hope for the best
	HA_CONFIG_ROOT="/config"
fi

INTEGRATION_DIR="${HA_CONFIG_ROOT}/custom_components/whatsapp"

# Debug Configuration
bashio::log.debug "--- Configurations ---"
bashio::log.debug "PORT: ${PORT}"
bashio::log.debug "LOG_LEVEL: ${LOG_LEVEL}"
bashio::log.debug "SEND_MESSAGE_TIMEOUT: ${SEND_MESSAGE_TIMEOUT}"
bashio::log.debug "KEEP_ALIVE_INTERVAL: ${KEEP_ALIVE_INTERVAL}"
bashio::log.debug "MASK_SENSITIVE_DATA: ${MASK_SENSITIVE_DATA}"
bashio::log.debug "WEBHOOK_ENABLED: ${WEBHOOK_ENABLED}"
bashio::log.debug "WEBHOOK_URL: ${WEBHOOK_URL}"
bashio::log.debug "UI_AUTH_ENABLED: ${UI_AUTH_ENABLED}"
bashio::log.debug "MARK_ONLINE: ${MARK_ONLINE}"
bashio::log.debug "SYNC_FULL_HISTORY: ${SYNC_FULL_HISTORY}"
bashio::log.debug "ADMIN_NOTIFICATIONS_ENABLED: ${ADMIN_NOTIFICATIONS_ENABLED}"
bashio::log.debug "WELCOME_MESSAGE_ENABLED: ${WELCOME_MESSAGE_ENABLED}"
bashio::log.debug "MEDIA_FOLDER: ${MEDIA_FOLDER}"
bashio::log.debug "MESSAGE_SEND_INTERVAL: ${MESSAGE_SEND_INTERVAL}"
bashio::log.debug "GROUP_FETCH_INTERVAL: ${GROUP_FETCH_INTERVAL}"
bashio::log.debug "GROUP_FETCH_COOLDOWN_ON_ERROR: ${GROUP_FETCH_COOLDOWN_ON_ERROR}"
bashio::log.debug "GROUP_FETCH_COOLDOWN_ON_RATE_LIMIT: ${GROUP_FETCH_COOLDOWN_ON_RATE_LIMIT}"
bashio::log.debug "NODE_TLS_REJECT_UNAUTHORIZED: ${NODE_TLS_REJECT_UNAUTHORIZED}"
bashio::log.debug "HA_CONFIG_ROOT: ${HA_CONFIG_ROOT}"
bashio::log.debug "INTEGRATION_DIR: ${INTEGRATION_DIR}"
bashio::log.debug "API_TOKEN length: ${#API_TOKEN}"
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
bashio::log.debug "AUTO_INSTALL_INTEGRATION: ${AUTO_INSTALL_INTEGRATION}"
bashio::log.debug "----------------------"
