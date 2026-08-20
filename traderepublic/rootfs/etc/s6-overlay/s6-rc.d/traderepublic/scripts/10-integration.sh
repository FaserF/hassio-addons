#!/usr/bin/with-contenv bashio
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

HA_CONFIG_ROOT="/config"
INTEGRATION_DIR="${HA_CONFIG_ROOT}/custom_components/traderepublic"
AUTO_INSTALL_INTEGRATION=$(bashio::config 'auto_install_integration' 'true')
GITHUB_TOKEN=$(bashio::config 'github_token' '')

install_integration() {
	local TAG_NAME=$1
	local IS_UPDATE=$2

	bashio::log.debug "install_integration: TAG_NAME='$TAG_NAME', IS_UPDATE='$IS_UPDATE'"
	bashio::log.info "Installing Trade Republic integration version: ${TAG_NAME:-Default Branch}..."

	mkdir -p "/tmp/ha-traderepublic_install"
	rm -rf "/tmp/ha-traderepublic_install"
	mkdir -p "/tmp/ha-traderepublic_install"

	local SUCCESS="false"
	if [ -n "$TAG_NAME" ]; then
		local ZIP_URL="https://github.com/FaserF/ha-traderepublic/releases/download/${TAG_NAME}/traderepublic.zip"
		bashio::log.info "Downloading $ZIP_URL..."
		local dl_code
		dl_code=$(curl -L -s --connect-timeout 10 --max-time 60 -w "%{http_code}" -o "/tmp/traderepublic.zip" "$ZIP_URL" 2>/dev/null)
		if [ "$dl_code" = "200" ] && [ -s "/tmp/traderepublic.zip" ]; then
			mkdir -p "/tmp/ha-traderepublic_install/custom_components/traderepublic"
			if unzip -q "/tmp/traderepublic.zip" -d "/tmp/ha-traderepublic_install/custom_components/traderepublic"; then
				SUCCESS="true"
			else
				bashio::log.error "❌ Failed to unzip release package."
			fi
			rm -f "/tmp/traderepublic.zip"
		else
			check_github_status "$dl_code" "Release download"
			bashio::log.error "❌ Failed to download release zip (HTTP $dl_code)."
			rm -f "/tmp/traderepublic.zip"
		fi
	else
		if git clone --depth 1 https://github.com/FaserF/ha-traderepublic.git "/tmp/ha-traderepublic_install" >/dev/null 2>&1; then
			SUCCESS="true"
		else
			bashio::log.error "❌ Failed to clone repository."
		fi
	fi

	if [ "$SUCCESS" = "true" ] && [ -d "/tmp/ha-traderepublic_install/custom_components/traderepublic" ]; then
		if [ -d "$INTEGRATION_DIR" ]; then
			bashio::log.info "Removing old integration version..."
			rm -rf "$INTEGRATION_DIR"
		fi

		mkdir -p "${HA_CONFIG_ROOT}/custom_components"
		cp -rf "/tmp/ha-traderepublic_install/custom_components/traderepublic" "${HA_CONFIG_ROOT}/custom_components/"

		if [ -d "$INTEGRATION_DIR" ]; then
			bashio::log.info "✅ Trade Republic Integration successfully installed/updated to $INTEGRATION_DIR"

			local MSG TITLE
			if [ "$IS_UPDATE" = "true" ]; then
				MSG="The Trade Republic integration has been updated to $TAG_NAME. Please restart Home Assistant."
				TITLE="Trade Republic Integration Updated"
			else
				MSG="The Trade Republic integration has been installed. Please restart Home Assistant."
				TITLE="Trade Republic Integration Installed"
			fi

			bashio::log.warning "RESTART HOME ASSISTANT to load the changes!"
			bashio::log.info "Publishing notification to Home Assistant..."

			curl -s -X POST \
				-H "Authorization: Bearer $SUPERVISOR_TOKEN" \
				-H "Content-Type: application/json" \
				-d "{\"title\": \"$TITLE\", \"message\": \"$MSG\", \"notification_id\": \"traderepublic_restart_required\"}" \
				http://supervisor/core/api/services/persistent_notification/create >/dev/null || true
		fi
	fi
	rm -rf "/tmp/ha-traderepublic_install"
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
	bashio::log.info "Fetching release information for ha-traderepublic..."
	CURL_AUTH=()
	if [ -n "$GITHUB_TOKEN" ] && [ "$GITHUB_TOKEN" != "null" ]; then
		CURL_AUTH=("-H" "Authorization: Bearer $GITHUB_TOKEN")
	fi
	rel_code=$(curl -s --connect-timeout 10 --max-time 30 -w "%{http_code}" "${CURL_AUTH[@]}" -A "HomeAssistant-App" -o /tmp/tr_releases.json "https://api.github.com/repos/FaserF/ha-traderepublic/releases" 2>/dev/null || echo "000")
	if [ "$rel_code" = "200" ] && [ -s /tmp/tr_releases.json ]; then
		RELEASES_JSON=$(cat /tmp/tr_releases.json)
	else
		check_github_status "$rel_code" "Releases check"
		RELEASES_JSON="[]"
	fi
	rm -f /tmp/tr_releases.json

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
			bashio::log.info "⬆️ Auto-updating Trade Republic integration to $TARGET_TAG..."
			install_integration "$TARGET_TAG" "true"
		else
			bashio::log.info "✨ Integration is up to date."
		fi
	fi
fi