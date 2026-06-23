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

bashio::log.info "Fetching release information from GitHub..."
RELEASES_JSON=$(curl -s --connect-timeout 10 --max-time 30 -A "HomeAssistant-Addon" "https://api.github.com/repos/FaserF/ha-webserver/releases")

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
if [ ! -d "$INTEGRATION_PATH/manifest.json" ]; then
	UPDATE_NEEDED="true"
elif [ -n "$TARGET_TAG" ]; then
	curr=$(echo "$LOCAL_VERSION" | sed 's/^v//')
	targ=$(echo "$TARGET_TAG" | sed 's/^v//')
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
	if ! curl -L -s -f -o "/tmp/webserver_app.zip" "$ZIP_URL"; then
		# Fallback to main branch zip if no target tag or error
		if [ -z "$TARGET_TAG" ]; then
			ZIP_URL="https://github.com/FaserF/ha-webserver/archive/refs/heads/main.zip"
			bashio::log.info "No target release tag, attempting main branch zip: $ZIP_URL"
			curl -L -s -f -o "/tmp/webserver_app.zip" "$ZIP_URL"
		fi
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

exit 0
