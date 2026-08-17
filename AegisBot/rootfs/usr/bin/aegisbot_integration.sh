#!/usr/bin/with-contenv bashio
# shellcheck shell=bash

# ==============================================================================
# AegisBot Integration Manager
# ==============================================================================
# Manages automatic installation, version comparison, release download,
# and supervisor discovery registration for the AegisBot Home Assistant integration.
# ==============================================================================

# Helper function to compare semantic versions
version_gt() {
	test "$(printf '%s\n' "$@" | sort -V | head -n 1)" != "$1"
}

# Helper to check GitHub status and diagnose failures
check_github_status() {
	local http_code="$1"
	local context="${2:-GitHub request}"

	case "$http_code" in
		000)
			bashio::log.warning "⚠️ $context: Connection timeout or unreachable network (HTTP 000)."
			;;
		401)
			bashio::log.warning "⚠️ $context: Authentication failed (HTTP 401 Unauthorized). Please check your token."
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

DOMAIN="aegisbot"
REPO="FaserF/ha-aegisbot"

# Detect Home Assistant configuration root directory (/homeassistant or /config)
HA_CONFIG_ROOT=""
for path in "/config" "/homeassistant"; do
	if [ -d "$path" ]; then
		HA_CONFIG_ROOT="$path"
		break
	fi
done

if [ -z "$HA_CONFIG_ROOT" ]; then
	bashio::log.warning "Could not find Home Assistant configuration directory in /config or /homeassistant. Defaulting to /config."
	HA_CONFIG_ROOT="/config"
fi

INTEGRATION_DIR="${HA_CONFIG_ROOT}/custom_components/${DOMAIN}"

# Check option flag: auto_install_integration (Default: true)
AUTO_INSTALL="true"
if bashio::config.false 'auto_install_integration'; then
	AUTO_INSTALL="false"
fi

# Retrieve optional GitHub token for rate limit prevention
GITHUB_TOKEN=""
if bashio::config.has_value 'github_token'; then
	GITHUB_TOKEN=$(bashio::config 'github_token')
fi

# Function to download and extract/install integration
install_integration() {
	local TAG_NAME="$1"
	local IS_UPDATE="$2"

	bashio::log.info "Installing AegisBot integration version: ${TAG_NAME:-Default Branch}..."

	local TMP_BUILD="/tmp/ha-aegisbot_install"
	rm -rf "$TMP_BUILD" 2>/dev/null
	mkdir -p "$TMP_BUILD"

	local SUCCESS="false"
	local CURL_AUTH=()
	if [ -n "$GITHUB_TOKEN" ] && [ "$GITHUB_TOKEN" != "null" ]; then
		CURL_AUTH=("-H" "Authorization: Bearer ${GITHUB_TOKEN}")
	fi

	if [ -n "$TAG_NAME" ]; then
		local ZIP_URL="https://github.com/${REPO}/releases/download/${TAG_NAME}/aegisbot.zip"
		bashio::log.info "Downloading integration package from ${ZIP_URL}..."
		local zip_code
		zip_code=$(curl "${CURL_AUTH[@]}" -L -s --connect-timeout 10 --max-time 60 -w "%{http_code}" -o "/tmp/aegisbot.zip" "${ZIP_URL}" 2>/dev/null)
		if [ "$zip_code" = "200" ] && [ -s "/tmp/aegisbot.zip" ]; then
			mkdir -p "${TMP_BUILD}/custom_components/aegisbot"
			if unzip -q "/tmp/aegisbot.zip" -d "${TMP_BUILD}/custom_components/aegisbot"; then
				SUCCESS="true"
			else
				bashio::log.error "❌ Failed to unzip integration package."
			fi
			rm -f "/tmp/aegisbot.zip"
		else
			check_github_status "$zip_code" "Release package download"
			bashio::log.error "❌ Failed to download release zip (HTTP $zip_code): ${ZIP_URL}"
			rm -f "/tmp/aegisbot.zip"
		fi
	fi

	# Fallback: archive zip from main branch
	if [ "$SUCCESS" != "true" ]; then
		local FALLBACK_URL="https://github.com/${REPO}/archive/refs/heads/main.zip"
		bashio::log.info "Attempting fallback download from ${FALLBACK_URL}..."
		local fb_code
		fb_code=$(curl "${CURL_AUTH[@]}" -L -s --connect-timeout 10 --max-time 60 -w "%{http_code}" -o "/tmp/aegisbot_fallback.zip" "${FALLBACK_URL}" 2>/dev/null)
		if [ "$fb_code" = "200" ] && [ -s "/tmp/aegisbot_fallback.zip" ]; then
			mkdir -p "${TMP_BUILD}/extracted"
			if unzip -q "/tmp/aegisbot_fallback.zip" -d "${TMP_BUILD}/extracted"; then
				local NESTED_DIR
				NESTED_DIR=$(find "${TMP_BUILD}/extracted" -name "manifest.json" -exec dirname {} \; | head -n 1)
				if [ -n "$NESTED_DIR" ]; then
					mkdir -p "${TMP_BUILD}/custom_components/aegisbot"
					cp -rf "${NESTED_DIR}/"* "${TMP_BUILD}/custom_components/aegisbot/"
					SUCCESS="true"
				fi
			fi
			rm -f "/tmp/aegisbot_fallback.zip"
		else
			check_github_status "$fb_code" "Fallback zip download"
			rm -f "/tmp/aegisbot_fallback.zip"
		fi
	fi

	if [ "$SUCCESS" = "true" ] && [ -d "${TMP_BUILD}/custom_components/aegisbot" ]; then
		if [ -d "$INTEGRATION_DIR" ]; then
			bashio::log.info "Removing old integration files at $INTEGRATION_DIR..."
			rm -rf "$INTEGRATION_DIR"
		fi

		mkdir -p "${HA_CONFIG_ROOT}/custom_components"
		cp -rf "${TMP_BUILD}/custom_components/aegisbot" "${HA_CONFIG_ROOT}/custom_components/"

		if [ -d "$INTEGRATION_DIR" ] && [ -f "$INTEGRATION_DIR/manifest.json" ]; then
			bashio::log.green "✅ AegisBot integration successfully installed/updated at $INTEGRATION_DIR"

			local TITLE MSG
			if [ "$IS_UPDATE" = "true" ]; then
				TITLE="AegisBot Integration Updated"
				MSG="The AegisBot integration has been updated to ${TAG_NAME:-latest}. Please restart Home Assistant."
			else
				TITLE="AegisBot Integration Installed"
				MSG="The AegisBot integration has been installed. Please restart Home Assistant."
			fi

			bashio::log.warning "⚠️ RESTART HOME ASSISTANT to apply integration changes!"

			curl -s -X POST \
				-H "Authorization: Bearer $SUPERVISOR_TOKEN" \
				-H "Content-Type: application/json" \
				-d "{\"title\": \"$TITLE\", \"message\": \"$MSG\", \"notification_id\": \"aegisbot_restart_required\"}" \
				http://supervisor/core/api/services/persistent_notification/create >/dev/null 2>&1 || true
		else
			bashio::log.error "❌ Copy failed: $INTEGRATION_DIR is missing manifest.json."
		fi
	else
		bashio::log.error "❌ Could not complete integration installation."
	fi

	rm -rf "$TMP_BUILD" 2>/dev/null
}

# Determine Channel (Edge vs Stable)
ADDON_INFO=$(curl -s --connect-timeout 5 --max-time 10 -H "Authorization: Bearer $SUPERVISOR_TOKEN" http://supervisor/addons/self/info 2>/dev/null || echo "{}")
SLUG=$(echo "$ADDON_INFO" | jq -r '.data.slug // empty' 2>/dev/null || echo "")
NAME=$(echo "$ADDON_INFO" | jq -r '.data.name // empty' 2>/dev/null || echo "")
VERSION=$(echo "$ADDON_INFO" | jq -r '.data.version // empty' 2>/dev/null || echo "")

bashio::log.info "Channel Detection - Slug: ${SLUG:-aegisbot}, Name: ${NAME:-AegisBot}, Version: ${VERSION:-unknown}"

if [[ "${SLUG}" == *"edge"* ]] || [[ "${NAME,,}" == *"edge"* ]] || [[ "${VERSION}" == *"dev"* ]] || [[ "${VERSION}" == *"git"* ]] || [[ "${VERSION}" =~ [0-9a-f]{7,40} ]]; then
	CHANNEL="edge"
	bashio::log.info "🟢 Edge/Dev channel detected. Will prefer Pre-releases."
else
	CHANNEL="stable"
	bashio::log.info "🔵 Stable channel detected."
fi

# Integration Management
if [ "$AUTO_INSTALL" = "false" ]; then
	bashio::log.info "Auto-installing/updating integration is disabled in configuration options."
else
	bashio::log.info "Fetching release information from GitHub..."
	CURL_AUTH=()
	if [ -n "$GITHUB_TOKEN" ] && [ "$GITHUB_TOKEN" != "null" ]; then
		CURL_AUTH=("-H" "Authorization: Bearer ${GITHUB_TOKEN}")
	fi

	local rel_code
	rel_code=$(curl -s --connect-timeout 10 --max-time 30 -w "%{http_code}" "${CURL_AUTH[@]}" -A "HomeAssistant-Addon" -o /tmp/aegisbot_releases.json "https://api.github.com/repos/${REPO}/releases" 2>/dev/null || echo "000")
	if [ "$rel_code" = "200" ] && [ -s /tmp/aegisbot_releases.json ]; then
		RELEASES_JSON=$(cat /tmp/aegisbot_releases.json)
	else
		check_github_status "$rel_code" "Releases check"
		RELEASES_JSON="[]"
	fi
	rm -f /tmp/aegisbot_releases.json

	if ! echo "$RELEASES_JSON" | jq -e 'if type=="array" then true else false end' >/dev/null 2>&1; then
		bashio::log.info "Note: Could not fetch releases (GitHub API rate limit or no internet). Skipping update checks."
		RELEASES_JSON="[]"
	fi

	TARGET_TAG=""
	if [ "$RELEASES_JSON" != "[]" ]; then
		if [ "$CHANNEL" = "edge" ]; then
			TARGET_TAG=$(echo "$RELEASES_JSON" | jq -r '.[0].tag_name // empty')
		else
			TARGET_TAG=$(echo "$RELEASES_JSON" | jq -r 'map(select(.prerelease == false)) | .[0].tag_name // empty')
		fi

		if [ -z "$TARGET_TAG" ] && [ "$CHANNEL" = "stable" ]; then
			if [ "$(echo "$RELEASES_JSON" | jq 'length')" -gt 0 ]; then
				TARGET_TAG=$(echo "$RELEASES_JSON" | jq -r '.[0].tag_name // empty')
				bashio::log.info "No stable release found, falling back to latest tag: $TARGET_TAG"
			fi
		fi
	fi

	if [ ! -d "$INTEGRATION_DIR" ]; then
		bashio::log.warning "Integration not found at $INTEGRATION_DIR"
		if [ -n "$TARGET_TAG" ]; then
			bashio::log.info "Target version (Initial Install): $TARGET_TAG"
			install_integration "$TARGET_TAG" "false"
		else
			bashio::log.info "No releases found. Installing from Main branch..."
			install_integration "" "false"
		fi
	else
		# Check if integration is official FaserF/ha-aegisbot
		IS_OFFICIAL="false"
		if [ -f "$INTEGRATION_DIR/manifest.json" ]; then
			if jq -e '(.codeowners // []) | contains(["@FaserF"]) or (.documentation // "" | contains("FaserF")) or (.issue_tracker // "" | contains("FaserF/ha-aegisbot"))' "$INTEGRATION_DIR/manifest.json" >/dev/null 2>&1; then
				IS_OFFICIAL="true"
			fi
		fi

		if [ "$IS_OFFICIAL" != "true" ]; then
			bashio::log.warning "⚠️ Existing integration at $INTEGRATION_DIR does not appear to be FaserF/ha-aegisbot. Overwriting with official release..."
			install_integration "$TARGET_TAG" "true"
		else
			bashio::log.info "✅ Official FaserF ha-aegisbot integration found at $INTEGRATION_DIR"

			INTEGRATION_VERSION=$(jq -r '.version // "unknown"' "$INTEGRATION_DIR/manifest.json" 2>/dev/null || echo "unknown")
			bashio::log.info "Integration Version: ${INTEGRATION_VERSION}"
			bashio::log.info "Checking for updates..."

			CURRENT_VERSION="$INTEGRATION_VERSION"
			UPDATE_NEEDED="false"

			if [ -n "$TARGET_TAG" ]; then
				curr="${CURRENT_VERSION#v}"
				targ="${TARGET_TAG#v}"

				if [ "$curr" != "$targ" ]; then
					if version_gt "$targ" "$curr"; then
						bashio::log.info "Update Available: $targ > $curr"
						UPDATE_NEEDED="true"
					else
						bashio::log.info "Current version ($curr) is up to date relative to target ($targ)."
					fi
				else
					bashio::log.info "Current version ($curr) matches target ($targ)."
				fi
			fi

			if [ "$UPDATE_NEEDED" = "true" ]; then
				bashio::log.info "⬆️  Auto-updating integration to $TARGET_TAG..."
				install_integration "$TARGET_TAG" "true"
			else
				bashio::log.info "✨ Integration is up to date."
			fi
		fi
	fi
fi

# Register discovery info in Supervisor
SLUG_NAME="${SLUG:-aegisbot}"
bashio::log.info "Registering discovery info in Supervisor for service 'aegisbot' (slug: $SLUG_NAME)..."
DISCOVERY_RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" -X POST \
	-H "Authorization: Bearer $SUPERVISOR_TOKEN" \
	-H "Content-Type: application/json" \
	-d "{\"service\":\"aegisbot\",\"config\":{\"addon\":\"$SLUG_NAME\"}}" \
	http://supervisor/discovery 2>/dev/null || echo "Failed")
bashio::log.info "Supervisor discovery response: $DISCOVERY_RESPONSE"

exit 0
