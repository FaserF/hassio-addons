#!/usr/bin/with-contenv bashio
# shellcheck shell=bash

# ==============================================================================
# AegisBot Integration Manager
# ==============================================================================
# This script manages the AegisBot integration in Home Assistant.
# It downloads the integration zip from the ha-aegisbot releases.
# ==============================================================================

# Constants
DOMAIN="aegisbot"
INTEGRATION_PATH="/config/custom_components/$DOMAIN"

bashio::log.info "Checking AegisBot integration..."

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

bashio::log.info "Fetching release information from GitHub..."
RELEASES_JSON=$(curl -s --connect-timeout 10 --max-time 30 -A "HomeAssistant-Addon" "https://api.github.com/repos/FaserF/ha-aegisbot/releases")

if ! echo "$RELEASES_JSON" | jq -e 'if type=="array" then true else false end' >/dev/null 2>&1; then
	bashio::log.info "Note: Could not fetch releases (GitHub API may be rate-limited). Skipping update checks."
	RELEASES_JSON="[]"
fi

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
	bashio::log.info "Installing/Updating AegisBot integration ($LOCAL_VERSION -> $TARGET_TAG)..."

	mkdir -p "/tmp/aegisbot_install"
	rm -rf "/tmp/aegisbot_install"
	mkdir -p "/tmp/aegisbot_install"

	ZIP_URL="https://github.com/FaserF/ha-aegisbot/releases/download/${TARGET_TAG}/aegisbot.zip"
	if ! curl -L -s -f -o "/tmp/aegisbot.zip" "$ZIP_URL"; then
		# Fallback to main branch zip if no target tag or error
		if [ -z "$TARGET_TAG" ]; then
			ZIP_URL="https://github.com/FaserF/ha-aegisbot/archive/refs/heads/main.zip"
			bashio::log.info "No target release tag, attempting main branch zip: $ZIP_URL"
			curl -L -s -f -o "/tmp/aegisbot.zip" "$ZIP_URL"
		fi
	fi

	if [ -f "/tmp/aegisbot.zip" ]; then
		if unzip -q "/tmp/aegisbot.zip" -d "/tmp/aegisbot_install"; then
			SRC_DIR=""
			if [ -f "/tmp/aegisbot_install/manifest.json" ]; then
				SRC_DIR="/tmp/aegisbot_install"
			elif [ -d "/tmp/aegisbot_install/custom_components/aegisbot" ]; then
				SRC_DIR="/tmp/aegisbot_install/custom_components/aegisbot"
			else
				nested_dir=$(find /tmp/aegisbot_install -name "manifest.json" -exec dirname {} \; | head -n 1)
				if [ -n "$nested_dir" ]; then
					SRC_DIR="$nested_dir"
				fi
			fi

			if [ -n "$SRC_DIR" ] && [ -f "$SRC_DIR/manifest.json" ]; then
				rm -rf "$INTEGRATION_PATH"
				mkdir -p "/config/custom_components"
				cp -rf "$SRC_DIR" "$INTEGRATION_PATH"
				bashio::log.green "AegisBot integration successfully updated to $TARGET_TAG."
				bashio::log.info "Please restart Home Assistant to apply changes."
			else
				bashio::log.error "❌ Could not find valid integration source files in extracted package."
			fi
		else
			bashio::log.error "❌ Failed to unzip package."
		fi
		rm -f "/tmp/aegisbot.zip"
	else
		bashio::log.error "❌ Download failed."
	fi
	rm -rf "/tmp/aegisbot_install"
else
	bashio::log.info "AegisBot integration is up to date ($LOCAL_VERSION)."
fi

# Register discovery info in Supervisor
bashio::log.info "Registering discovery info in Supervisor for slug: $SLUG..."
DISCOVERY_RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" -X POST \
  -H "Authorization: Bearer $SUPERVISOR_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"service\":\"aegisbot\",\"config\":{\"addon\":\"$SLUG\"}}" \
  http://supervisor/discovery)
bashio::log.info "Supervisor discovery response: $DISCOVERY_RESPONSE"

exit 0
