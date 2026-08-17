#!/usr/bin/with-contenv bashio
# shellcheck shell=bash

# ==============================================================================
# Webserver App Integration Manager
# ==============================================================================
# This script manages the Webserver App integration in Home Assistant.
# It downloads the integration zip from the ha-webserver releases.
# ==============================================================================

# Constants
DOMAIN="webserver_app"
INTEGRATION_PATH="/config/custom_components/$DOMAIN"

bashio::log.info "Checking Webserver App integration..."

# Ensure directory exists
if ! mkdir -p "$INTEGRATION_PATH" 2>/dev/null; then
	bashio::log.error "Could not create integration directory at $INTEGRATION_PATH"
	exit 0
fi

# Determine Channel (Edge vs Stable)
ADDON_INFO=$(curl -s --connect-timeout 5 --max-time 10 -H "Authorization: Bearer $SUPERVISOR_TOKEN" http://supervisor/addons/self/info)
SLUG=$(echo "$ADDON_INFO" | jq -r '.data.slug // empty')
NAME=$(echo "$ADDON_INFO" | jq -r '.data.name // empty')
VERSION=$(echo "$ADDON_INFO" | jq -r '.data.version // empty')

if [[ "${SLUG}" == *"edge"* ]] || [[ "${NAME,,}" == *"edge"* ]] || [[ "${VERSION}" == *"dev"* ]] || [[ "${VERSION}" == *"git"* ]] || [[ "${VERSION}" =~ [0-9a-f]{7,40} ]]; then
	CHANNEL="edge"
	bashio::log.info "🟢 Edge/Dev channel detected. Will prefer Pre-releases."
else
	CHANNEL="stable"
	bashio::log.info "🔵 Stable channel detected."
fi

# Helper to check GitHub status and diagnose failures
check_github_status() {
	local http_code="$1"
	local context="${2:-GitHub request}"

	case "$http_code" in
		000)
			bashio::log.warning "⚠️ $context: Connection timeout or unreachable network (HTTP 000)."
			;;
		401)
			bashio::log.warning "⚠️ $context: Authentication failed (HTTP 401 Unauthorized)."
			;;
		403)
			bashio::log.warning "⚠️ $context: Access forbidden or API rate limit exceeded (HTTP 403)."
			;;
		404)
			bashio::log.warning "⚠️ $context: Resource not found (HTTP 404)."
			;;
		429)
			bashio::log.warning "⚠️ $context: Too many requests / API rate limit exceeded (HTTP 429)."
			;;
		500|502|503|504)
			bashio::log.warning "⚠️ $context: GitHub server error (HTTP $http_code)."
			;;
		*)
			bashio::log.warning "⚠️ $context returned HTTP $http_code."
			;;
	esac

	# If server error (5xx) or connection timeout (000), check GitHub Status API
	if [[ "$http_code" =~ ^(000|500|502|503|504)$ ]]; then
		local gh_status
		gh_status=$(curl -s --connect-timeout 5 --max-time 10 "https://www.githubstatus.com/api/v2/status.json" 2>/dev/null || echo "")
		if [ -n "$gh_status" ]; then
			local indicator description
			indicator=$(echo "$gh_status" | jq -r '.status.indicator // "none"' 2>/dev/null || echo "none")
			description=$(echo "$gh_status" | jq -r '.status.description // empty' 2>/dev/null || echo "")
			if [ "$indicator" != "none" ] && [ -n "$description" ]; then
				bashio::log.error "🚨 GitHub Incident active: $description (Status: $indicator)"
				bashio::log.error "   Please check https://www.githubstatus.com for live status updates."
			fi
		fi
	fi
}

bashio::log.info "Fetching release information from GitHub..."
local rel_code
rel_code=$(curl -s --connect-timeout 10 --max-time 30 -w "%{http_code}" -A "HomeAssistant-Addon" -o /tmp/webserver_releases.json "https://api.github.com/repos/FaserF/ha-webserver/releases" 2>/dev/null || echo "000")

if [ "$rel_code" = "200" ] && [ -s /tmp/webserver_releases.json ]; then
	RELEASES_JSON=$(cat /tmp/webserver_releases.json)
else
	check_github_status "$rel_code" "Releases check"
	RELEASES_JSON="[]"
fi
rm -f /tmp/webserver_releases.json

TARGET_TAG=""
if [ "$RELEASES_JSON" != "[]" ]; then
	if [ "$CHANNEL" == "edge" ]; then
		TARGET_TAG=$(echo "$RELEASES_JSON" | jq -r '.[0].tag_name // empty')
	else
		TARGET_TAG=$(echo "$RELEASES_JSON" | jq -r 'map(select(.prerelease == false)) | .[0].tag_name // empty')
	fi
fi

# Get local version
LOCAL_VERSION="none"
if [ -f "$INTEGRATION_PATH/manifest.json" ]; then
	LOCAL_VERSION=$(jq -r '.version' "$INTEGRATION_PATH/manifest.json" 2>/dev/null || echo "none")
fi

# Compare
UPDATE_NEEDED="false"
if [ ! -f "$INTEGRATION_PATH/manifest.json" ]; then
	UPDATE_NEEDED="true"
elif [ -n "$TARGET_TAG" ]; then
	curr="${LOCAL_VERSION#v}"
	targ="${TARGET_TAG#v}"
	if [ "$curr" != "$targ" ]; then
		# Check if target is greater than current
		if test "$(printf '%s\n' "$curr" "$targ" | sort -V | head -n 1)" != "$targ"; then
			UPDATE_NEEDED="true"
		fi
	fi
fi

if [ "$UPDATE_NEEDED" = "true" ]; then
	bashio::log.info "Installing/Updating Webserver App integration ($LOCAL_VERSION -> $TARGET_TAG)..."

	mkdir -p "/tmp/webserver_install"
	rm -rf "/tmp/webserver_install"
	mkdir -p "/tmp/webserver_install"

	ZIP_URL="https://github.com/FaserF/ha-webserver/releases/download/${TARGET_TAG}/webserver_app.zip"
	local dl_code
	dl_code=$(curl -L -s --connect-timeout 10 --max-time 60 -w "%{http_code}" -o "/tmp/webserver_app.zip" "$ZIP_URL" 2>/dev/null)
	if [ "$dl_code" != "200" ] || [ ! -s "/tmp/webserver_app.zip" ]; then
		check_github_status "$dl_code" "Release package download"
		# Fallback to main branch zip if no target tag or error
		ZIP_URL="https://github.com/FaserF/ha-webserver/archive/refs/heads/main.zip"
		bashio::log.info "Attempting main branch zip fallback: $ZIP_URL"
		curl -L -s --connect-timeout 10 --max-time 60 -o "/tmp/webserver_app.zip" "$ZIP_URL" 2>/dev/null
	fi

	if [ -f "/tmp/webserver_app.zip" ]; then
		if unzip -q "/tmp/webserver_app.zip" -d "/tmp/webserver_install"; then
			SRC_DIR=""
			if [ -f "/tmp/webserver_install/manifest.json" ]; then
				SRC_DIR="/tmp/webserver_install"
			elif [ -d "/tmp/webserver_install/custom_components/webserver_app" ]; then
				SRC_DIR="/tmp/webserver_install/custom_components/webserver_app"
			else
				nested_dir=$(find /tmp/webserver_install -name "manifest.json" -exec dirname {} \; | head -n 1)
				if [ -n "$nested_dir" ]; then
					SRC_DIR="$nested_dir"
				fi
			fi

			if [ -n "$SRC_DIR" ] && [ -f "$SRC_DIR/manifest.json" ]; then
				rm -rf "$INTEGRATION_PATH"
				mkdir -p "/config/custom_components"
				cp -rf "$SRC_DIR" "$INTEGRATION_PATH"
				bashio::log.green "Webserver App integration successfully updated to $TARGET_TAG."
				bashio::log.info "Please restart Home Assistant to apply changes."
			else
				bashio::log.error "❌ Could not find valid integration source files in extracted package."
			fi
		else
			bashio::log.error "❌ Failed to unzip package."
		fi
		rm -f "/tmp/webserver_app.zip"
	else
		bashio::log.error "❌ Download failed."
	fi
	rm -rf "/tmp/webserver_install"
else
	bashio::log.info "Webserver App integration is up to date ($LOCAL_VERSION)."
fi

# Register discovery info in Supervisor
bashio::log.info "Registering discovery info in Supervisor for slug: $SLUG..."
DISCOVERY_RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" -X POST \
	-H "Authorization: Bearer $SUPERVISOR_TOKEN" \
	-H "Content-Type: application/json" \
	-d "{\"service\":\"webserver_app\",\"config\":{\"addon\":\"$SLUG\"}}" \
	http://supervisor/discovery)
bashio::log.info "Supervisor discovery response: $DISCOVERY_RESPONSE"

exit 0
