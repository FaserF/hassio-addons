#!/usr/bin/with-contenv bashio

# Function to compare semantic versions
version_gt() {
    test "$(printf '%s\n' "$@" | sort -V | head -n 1)" != "$1"
}

# Function to install/update integration
install_integration() {
    local TAG_NAME=$1
    local IS_UPDATE=$2

    bashio::log.debug "install_integration details: TAG_NAME='${TAG_NAME}', IS_UPDATE='${IS_UPDATE}'"
    bashio::log.info "Installing integration version: ${TAG_NAME:-Default Branch}..."

    if [ -n "$TAG_NAME" ]; then
        CLONE_ARGS=("--branch" "$TAG_NAME")
    else
        CLONE_ARGS=()
    fi

    mkdir -p "/tmp/ha-whatsapp_install"
    rm -rf "/tmp/ha-whatsapp_install" # Ensure clean state
    mkdir -p "/tmp/ha-whatsapp_install"

    local SUCCESS="false"
    if [ -n "$TAG_NAME" ]; then
        local ZIP_URL="https://github.com/FaserF/ha-whatsapp/releases/download/${TAG_NAME}/whatsapp.zip"
        bashio::log.info "Downloading ${ZIP_URL}..."
        if curl -L -s -f -o "/tmp/whatsapp.zip" "${ZIP_URL}"; then
            mkdir -p "/tmp/ha-whatsapp_install/custom_components/whatsapp"
            if unzip -q "/tmp/whatsapp.zip" -d "/tmp/ha-whatsapp_install/custom_components/whatsapp"; then
                SUCCESS="true"
            else
                bashio::log.error "❌ Failed to unzip release package."
            fi
            rm -f "/tmp/whatsapp.zip"
        else
            bashio::log.error "❌ Failed to download release zip."
        fi
    else
        # Fallback to cloning main branch
        if git clone --depth 1 https://github.com/FaserF/ha-whatsapp.git "/tmp/ha-whatsapp_install" > /dev/null 2>&1; then
            SUCCESS="true"
        else
            bashio::log.error "❌ Failed to clone repository."
        fi
    fi

    if [ "$SUCCESS" = "true" ] && [ -d "/tmp/ha-whatsapp_install/custom_components/whatsapp" ]; then
        # Check if we are updating, if so remove old
        if [ -d "$INTEGRATION_DIR" ]; then
             bashio::log.info "Removing old integration version..."
             rm -rf "$INTEGRATION_DIR"
        fi

        mkdir -p "${HA_CONFIG_ROOT}/custom_components"
        # Use cp -rf for forceful copy
        cp -rf "/tmp/ha-whatsapp_install/custom_components/whatsapp" "${HA_CONFIG_ROOT}/custom_components/"

        # Double check installation
        if [ -d "$INTEGRATION_DIR" ]; then
            bashio::log.info "✅ Integration successfully installed/updated to $INTEGRATION_DIR"

            if [ "$IS_UPDATE" = "true" ]; then
                MSG="The WhatsApp integration has been updated to $TAG_NAME. Please restart Home Assistant."
                TITLE="WhatsApp Integration Updated"
            else
                MSG="The WhatsApp integration has been installed. Please restart Home Assistant."
                TITLE="WhatsApp Integration Installed"
            fi

            bashio::log.warning "RESTART HOME ASSISTANT to load the changes!"
            bashio::log.info "Publishing notification to Home Assistant..."

            curl -s -X POST \
                -H "Authorization: Bearer $SUPERVISOR_TOKEN" \
                -H "Content-Type: application/json" \
                -d "{\"title\": \"$TITLE\", \"message\": \"$MSG\", \"notification_id\": \"whatsapp_restart_required\"}" \
                http://supervisor/core/api/services/persistent_notification/create > /dev/null
        else
            bashio::log.error "❌ Copy failed: $INTEGRATION_DIR still does not exist."
        fi
    else
        bashio::log.error "❌ Could not complete installation: Source component missing or download failed."
    fi
    rm -rf "/tmp/ha-whatsapp_install"
}

# Determine Channel (Edge vs Stable)
ADDON_INFO=$(curl -s -f -H "Authorization: Bearer $SUPERVISOR_TOKEN" http://supervisor/addons/self/info || echo "{}")
bashio::log.trace "Addon Info API response: ${ADDON_INFO}"
SLUG=$(echo "$ADDON_INFO" | jq -r '.data.slug // empty' 2>/dev/null || echo "")
NAME=$(echo "$ADDON_INFO" | jq -r '.data.name // empty' 2>/dev/null || echo "")
VERSION=$(echo "$ADDON_INFO" | jq -r '.data.version // empty' 2>/dev/null || echo "")
export ADDON_VERSION="${VERSION}"
export ADDON_SLUG="${SLUG}"

bashio::log.info "Channel Detection - Slug: ${SLUG}, Name: ${NAME}, Version: ${VERSION}"

if [[ "${SLUG}" == *"edge"* ]] || \
   [[ "${NAME,,}" == *"edge"* ]] || \
   [[ "${VERSION}" == *"dev"* ]] || \
   [[ "${VERSION}" == *"git"* ]] || \
   [[ "${VERSION}" =~ [0-9a-f]{7,40} ]]; then
    CHANNEL="edge"
    bashio::log.info "🟢 Edge/Dev channel detected. Will prefer Pre-releases."
else
    CHANNEL="stable"
    bashio::log.info "🔵 Stable channel detected."
fi

# Manage Integration
if [ "$AUTO_INSTALL_INTEGRATION" = "false" ]; then
    bashio::log.info "Auto-installing/updating integration is disabled in configuration options."
else
    # Fetch Releases once
    bashio::log.info "Fetching release information..."
    CURL_AUTH=()
    if [ -n "${GITHUB_TOKEN:-}" ] && [ "$GITHUB_TOKEN" != "null" ]; then
        CURL_AUTH=("-H" "Authorization: Bearer ${GITHUB_TOKEN}")
    fi
    RELEASES_JSON=$(curl -s -f "${CURL_AUTH[@]}" -A "HomeAssistant-Addon" "https://api.github.com/repos/FaserF/ha-whatsapp/releases" || echo "[]")
    bashio::log.trace "GitHub Releases API response length: ${#RELEASES_JSON}"

    # Valid JSON check
    if ! echo "$RELEASES_JSON" | jq -e 'if type=="array" then true else false end' > /dev/null 2>&1; then
        bashio::log.info "Note: Could not fetch releases (GitHub API may be rate-limited). Skipping update checks."
        RELEASES_JSON="[]"
    fi

    # Determine Latest Versions based on channel
    TARGET_TAG=""
    if [ "$RELEASES_JSON" != "[]" ]; then
        if [ "$CHANNEL" == "edge" ]; then
            # Edge: Latest release (whether stable or beta)
            TARGET_TAG=$(echo "$RELEASES_JSON" | jq -r '.[0].tag_name // empty')
        else
            # Stable: Latest non-prerelease
            TARGET_TAG=$(echo "$RELEASES_JSON" | jq -r 'map(select(.prerelease == false)) | .[0].tag_name // empty')
        fi

        # Fallback: If stable search failed but we have releases, ensure we dont leave TARGET_TAG empty if possible
        if [ -z "$TARGET_TAG" ] && [ "$CHANNEL" == "stable" ]; then
            if [ "$(echo "$RELEASES_JSON" | jq 'length')" -gt 0 ]; then
                fallback=$(echo "$RELEASES_JSON" | jq -r '.[0].tag_name')
                bashio::log.info "No stable release found, falling back to latest tag: $fallback"
                TARGET_TAG="$fallback"
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
        # Validate that the integration is actually FaserF's ha-whatsapp
        IS_FASERF_INTEGRATION="false"
        if [ -f "$INTEGRATION_DIR/manifest.json" ]; then
            if jq -e '(.codeowners // []) | contains(["@FaserF"]) or (.documentation // "" | contains("FaserF")) or (.issue_tracker // "" | contains("FaserF/ha-whatsapp"))' "$INTEGRATION_DIR/manifest.json" >/dev/null 2>&1; then
                IS_FASERF_INTEGRATION="true"
            fi
        fi

        if [ "$IS_FASERF_INTEGRATION" != "true" ]; then
            bashio::log.warning "⚠️ Existing integration at $INTEGRATION_DIR does not appear to be FaserF/ha-whatsapp (missing @FaserF codeowners / documentation / issue_tracker). Overwriting with official release..."
            install_integration "$TARGET_TAG" "true"
        else
            bashio::log.info "✅ Official FaserF ha-whatsapp integration found at $INTEGRATION_DIR"

            # Export integration version for Node.js app
            INTEGRATION_VERSION=$(jq -r '.version // "unknown"' "$INTEGRATION_DIR/manifest.json")
            export INTEGRATION_VERSION
            bashio::log.info "Integration Version: ${INTEGRATION_VERSION}"

            bashio::log.info "Checking for updates..."

            CURRENT_VERSION="$INTEGRATION_VERSION"
            bashio::log.info "Current Version: $CURRENT_VERSION"

            UPDATE_NEEDED="false"

            # Comparison Logic
            if [ -n "$TARGET_TAG" ]; then
                 curr=$(echo "$CURRENT_VERSION" | sed 's/^v//')
                 targ=$(echo "$TARGET_TAG" | sed 's/^v//')
                 bashio::log.debug "Normalized versions - Current: ${curr}, Target: ${targ}"

                 if [ "$curr" != "$targ" ]; then
                     if version_gt "$targ" "$curr"; then
                         bashio::log.info "Update Available: $targ > $curr"
                         UPDATE_NEEDED="true"
                     else
                         if version_gt "$curr" "$targ"; then
                             bashio::log.info "Current version ($curr) is newer than target ($targ)."
                         else
                             bashio::log.info "Current version ($curr) is equal to target ($targ)."
                         fi
                     fi
                 else
                     bashio::log.info "Current version ($curr) matches target ($targ)."
                 fi
            elif [ "$RELEASES_JSON" != "[]" ]; then
                 bashio::log.warning "Could not determine target tag from GitHub releases."
            fi

            if [ "$UPDATE_NEEDED" == "true" ]; then
                 bashio::log.info "⬆️  Auto-updating to $TARGET_TAG..."
                 install_integration "$TARGET_TAG" "true"
            else
                 bashio::log.info "✨ Integration is up to date."
            fi
        fi
    fi
fi
