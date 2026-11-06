#!/usr/bin/with-contenv bashio
# shellcheck disable=SC1091,SC2155
# shellcheck shell=bash

# Function to compare semantic versions
version_gt() {
	test "$(printf '%s\n' "$@" | sort -V | head -n 1)" != "$1"
}

check_github_status() {
	local http_code="$1"
	local context="${2:-GitHub request}"

	case "$http_code" in
	000) bashio::log.warning "⚠️ $context: Connection timeout or unreachable network (HTTP 000)." ;;
	401) bashio::log.warning "⚠️ $context: Authentication failed (HTTP 401 Unauthorized)." ;;
	403) bashio::log.warning "⚠️ $context: Access forbidden or API rate limit exceeded (HTTP 403)." ;;
	404) bashio::log.warning "⚠️ $context: Resource not found (HTTP 404)." ;;
	429) bashio::log.warning "⚠️ $context: Too many requests / API rate limit exceeded (HTTP 429)." ;;
	500 | 502 | 503 | 504) bashio::log.warning "⚠️ $context: GitHub server error (HTTP $http_code)." ;;
	*) bashio::log.warning "⚠️ $context returned HTTP $http_code." ;;
	esac
}

HA_CONFIG_ROOT="${HA_CONFIG_ROOT:-/config}"
INTEGRATION_DIR="${INTEGRATION_DIR:-${HA_CONFIG_ROOT}/custom_components/google_home}"
AUTO_INSTALL_INTEGRATION="${AUTO_INSTALL_INTEGRATION:-true}"
GITHUB_TOKEN="${GITHUB_TOKEN:-}"

install_integration() {
	local TAG_NAME="$1"
	local IS_UPDATE="$2"

	bashio::log.debug "install_integration: TAG_NAME='$TAG_NAME', IS_UPDATE='$IS_UPDATE'"
	bashio::log.info "Installing Google Home integration version: ${TAG_NAME:-Default Branch}..."

	mkdir -p "/tmp/ha-googlehome_install"
	rm -rf "/tmp/ha-googlehome_install"
	mkdir -p "/tmp/ha-googlehome_install"

	local SUCCESS="false"
	if [ -n "$TAG_NAME" ]; then
		local ZIP_URL="https://github.com/FaserF/ha-googlehome/releases/download/${TAG_NAME}/google_home.zip"
		bashio::log.info "Downloading $ZIP_URL..."
		local dl_code
		dl_code=$(curl -L -s --connect-timeout 10 --max-time 60 -w "%{http_code}" -o "/tmp/google_home.zip" "$ZIP_URL" 2>/dev/null)
		if [ "$dl_code" = "200" ] && [ -s "/tmp/google_home.zip" ]; then
			mkdir -p "/tmp/ha-googlehome_install/custom_components/google_home"
			if unzip -q "/tmp/google_home.zip" -d "/tmp/ha-googlehome_install/custom_components/google_home"; then
				SUCCESS="true"
			else
				bashio::log.error "❌ Failed to unzip release package."
			fi
			rm -f "/tmp/google_home.zip"
		else
			check_github_status "$dl_code" "Release download"
			bashio::log.error "❌ Failed to download release zip (HTTP $dl_code)."
			rm -f "/tmp/google_home.zip"
		fi
	else
		# Fallback to cloning or downloading main branch
		if git clone --depth 1 https://github.com/FaserF/ha-googlehome.git "/tmp/ha-googlehome_install" >/dev/null 2>&1; then
			SUCCESS="true"
		else
			bashio::log.info "Git clone fallback: Downloading main branch archive via curl..."
			local archive_code
			archive_code=$(curl -L -s --connect-timeout 10 --max-time 60 -w "%{http_code}" -o "/tmp/main.tar.gz" "https://github.com/FaserF/ha-googlehome/archive/refs/heads/main.tar.gz" 2>/dev/null)
			if [ "$archive_code" = "200" ] && [ -s "/tmp/main.tar.gz" ]; then
				mkdir -p "/tmp/ha-googlehome_extract"
				if tar -xzf "/tmp/main.tar.gz" -C "/tmp/ha-googlehome_extract" 2>/dev/null; then
					mkdir -p "/tmp/ha-googlehome_install/custom_components"
					cp -rf /tmp/ha-googlehome_extract/*/custom_components/google_home "/tmp/ha-googlehome_install/custom_components/"
					SUCCESS="true"
				fi
				rm -rf "/tmp/ha-googlehome_extract" "/tmp/main.tar.gz"
			else
				bashio::log.error "❌ Failed to clone repository or download archive."
			fi
		fi
	fi

	if [ "$SUCCESS" = "true" ] && [ -d "/tmp/ha-googlehome_install/custom_components/google_home" ]; then
		if [ -d "$INTEGRATION_DIR" ]; then
			bashio::log.info "Removing old integration version..."
			rm -rf "$INTEGRATION_DIR"
		fi

		mkdir -p "${HA_CONFIG_ROOT}/custom_components"
		cp -rf "/tmp/ha-googlehome_install/custom_components/google_home" "${HA_CONFIG_ROOT}/custom_components/"

		if [ -d "$INTEGRATION_DIR" ]; then
			bashio::log.info "✅ Google Home Integration successfully installed/updated to $INTEGRATION_DIR"

			local MSG TITLE
			if [ "$IS_UPDATE" = "true" ]; then
				MSG="The Google Home integration has been updated to $TAG_NAME. Please restart Home Assistant."
				TITLE="Google Home Integration Updated"
			else
				MSG="The Google Home integration has been installed. Please restart Home Assistant."
				TITLE="Google Home Integration Installed"
			fi

			bashio::log.warning "RESTART HOME ASSISTANT to load the changes!"
			bashio::log.info "Publishing notification to Home Assistant..."

			curl -s -X POST \
				-H "Authorization: Bearer $SUPERVISOR_TOKEN" \
				-H "Content-Type: application/json" \
				-d "{\"title\": \"$TITLE\", \"message\": \"$MSG\", \"notification_id\": \"googlehome_restart_required\"}" \
				http://supervisor/core/api/services/persistent_notification/create >/dev/null || true
		fi
	fi
	rm -rf "/tmp/ha-googlehome_install"
}

# Channel detection
ADDON_INFO=$(curl -s -f -H "Authorization: Bearer $SUPERVISOR_TOKEN" http://supervisor/addons/self/info 2>/dev/null || echo "{}")
SLUG=$(echo "$ADDON_INFO" | jq -r '.data.slug // empty' 2>/dev/null || echo "")
NAME=$(echo "$ADDON_INFO" | jq -r '.data.name // empty' 2>/dev/null || echo "")
VERSION=$(echo "$ADDON_INFO" | jq -r '.data.version // empty' 2>/dev/null || echo "")

if [[ "$SLUG" == *"edge"* ]] || [[ "${NAME,,}" == *"edge"* ]] || [[ "$VERSION" == *"dev"* ]] || [[ "$VERSION" == *"git"* ]] || [[ "$VERSION" =~ [0-9a-f]{7,40} ]]; then
	CHANNEL="edge"
	bashio::log.info "🟢 Edge/Dev channel detected. Will prefer Pre-releases."
else
	CHANNEL="stable"
	bashio::log.info "🔵 Stable channel detected."
fi

if [ "$AUTO_INSTALL_INTEGRATION" = "false" ]; then
	bashio::log.info "Auto-installing/updating integration is disabled in configuration."
else
	bashio::log.info "Fetching release information for ha-googlehome..."
	CURL_AUTH=()
	if [ -n "$GITHUB_TOKEN" ] && [ "$GITHUB_TOKEN" != "null" ]; then
		CURL_AUTH=("-H" "Authorization: Bearer $GITHUB_TOKEN")
	fi
	rel_code=$(curl -s --connect-timeout 10 --max-time 30 -w "%{http_code}" "${CURL_AUTH[@]}" -A "HomeAssistant-App" -o /tmp/gh_releases.json "https://api.github.com/repos/FaserF/ha-googlehome/releases" 2>/dev/null || echo "000")
	if [ "$rel_code" = "200" ] && [ -s /tmp/gh_releases.json ]; then
		RELEASES_JSON=$(cat /tmp/gh_releases.json)
	else
		check_github_status "$rel_code" "Releases check"
		RELEASES_JSON="[]"
	fi
	rm -f /tmp/gh_releases.json

	TARGET_TAG=""
	if [ "$RELEASES_JSON" != "[]" ]; then
		if [ "$CHANNEL" = "edge" ]; then
			TARGET_TAG=$(echo "$RELEASES_JSON" | jq -r '.[0].tag_name // empty')
		else
			TARGET_TAG=$(echo "$RELEASES_JSON" | jq -r 'map(select(.prerelease == false)) | .[0].tag_name // empty')
		fi
		if [ -z "$TARGET_TAG" ] && [ "$CHANNEL" = "stable" ]; then
			if [ "$(echo "$RELEASES_JSON" | jq 'length')" -gt 0 ]; then
				TARGET_TAG=$(echo "$RELEASES_JSON" | jq -r '.[0].tag_name')
			fi
		fi
	fi

	if [ ! -d "$INTEGRATION_DIR" ]; then
		bashio::log.warning "Integration not found in $INTEGRATION_DIR"
		if [ -n "$TARGET_TAG" ]; then
			bashio::log.info "Target version (Initial Install): $TARGET_TAG"
			install_integration "$TARGET_TAG" "false"
		else
			bashio::log.info "No releases found. Installing from Main branch..."
			install_integration "" "false"
		fi
	else
		INTEGRATION_VERSION=$(jq -r '.version // "unknown"' "$INTEGRATION_DIR/manifest.json" 2>/dev/null || echo "unknown")
		bashio::log.info "Integration Version: $INTEGRATION_VERSION"

		CURRENT_VERSION="$INTEGRATION_VERSION"
		UPDATE_NEEDED="false"

		if [ -n "$TARGET_TAG" ]; then
			curr="${CURRENT_VERSION#v}"
			targ="${TARGET_TAG#v}"
			if [ "$curr" != "$targ" ]; then
				if version_gt "$targ" "$curr"; then
					bashio::log.info "Update Available: $targ > $curr"
					UPDATE_NEEDED="true"
				fi
			fi
		fi

		if [ "$UPDATE_NEEDED" = "true" ]; then
			bashio::log.info "⬆️ Auto-updating Google Home integration to $TARGET_TAG..."
			install_integration "$TARGET_TAG" "true"
		else
			bashio::log.info "✨ Integration is up to date."
		fi
	fi
fi
