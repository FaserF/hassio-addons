#!/usr/bin/with-contenv bashio
# shellcheck shell=bash

# ==============================================================================
# Webserver App Integration Manager
# ==============================================================================
# This script manages the Webserver App integration in Home Assistant.
# It checks for updates on GitHub and installs/updates the integration.
# ==============================================================================

# Constants
DOMAIN="webserver_app"
REPO="FaserF/hassio-addons"
INTEGRATION_PATH="/config/custom_components/$DOMAIN"
GITHUB_API_URL="https://api.github.com/repos/$REPO/contents/custom_components/$DOMAIN"
GITHUB_RAW_URL="https://raw.githubusercontent.com/$REPO/master/custom_components/$DOMAIN"

bashio::log.info "Checking Webserver App integration..."

# Function to get local version
get_local_version() {
	if [ -f "$INTEGRATION_PATH/manifest.json" ]; then
		jq -r '.version' "$INTEGRATION_PATH/manifest.json" 2>/dev/null || echo "none"
	else
		echo "none"
	fi
}

# Function to get remote version
get_remote_version() {
	local version
	version=$(curl -sSL -m 10 -H "Accept: application/vnd.github.v3+json" "$GITHUB_RAW_URL/manifest.json" | jq -r '.version' 2>/dev/null)
	if [ -z "$version" ] || [ "$version" = "null" ]; then
		echo "error"
	else
		echo "$version"
	fi
}

# Ensure directory exists
if ! mkdir -p "$INTEGRATION_PATH" 2>/dev/null; then
	bashio::log.error "Could not create integration directory at $INTEGRATION_PATH"
	exit 0
fi

LOCAL_VERSION=$(get_local_version)
REMOTE_VERSION=$(get_remote_version)

if [ "$REMOTE_VERSION" = "error" ]; then
	bashio::log.warning "Could not check for integration updates (GitHub connectivity issue or API error)."
	exit 0
fi

if [ "$LOCAL_VERSION" != "$REMOTE_VERSION" ]; then
	bashio::log.info "Installing/Updating Webserver App integration ($LOCAL_VERSION -> $REMOTE_VERSION)..."

	# Get file list from GitHub
	FILES=$(curl -sSL -m 10 -H "Accept: application/vnd.github.v3+json" "$GITHUB_API_URL" | jq -r '.[] | select(.type == "file") | .name' 2>/dev/null)

	if [ -z "$FILES" ]; then
		bashio::log.error "Could not retrieve file list for integration."
		exit 0
	fi

	for file in $FILES; do
		bashio::log.info "Downloading $file..."
		if ! curl -sSL -m 15 "$GITHUB_RAW_URL/$file" -o "$INTEGRATION_PATH/$file"; then
			bashio::log.error "Failed to download $file. Aborting update."
			exit 0
		fi
	done

	# Handle translations
	mkdir -p "$INTEGRATION_PATH/translations"
	TRANSLATION_FILES=$(curl -sSL -m 10 -H "Accept: application/vnd.github.v3+json" "$GITHUB_API_URL/translations" | jq -r '.[] | select(.type == "file") | .name' 2>/dev/null || echo "")
	for t_file in $TRANSLATION_FILES; do
		bashio::log.info "Downloading translation $t_file..."
		curl -sSL -m 10 "$GITHUB_RAW_URL/translations/$t_file" -o "$INTEGRATION_PATH/translations/$t_file" || true
	done

	bashio::log.green "Webserver App integration successfully updated to $REMOTE_VERSION."
	bashio::log.info "Please restart Home Assistant to apply changes."
else
	bashio::log.info "Webserver App integration is up to date ($LOCAL_VERSION)."
fi

exit 0
