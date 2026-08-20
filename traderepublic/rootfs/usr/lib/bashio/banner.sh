#!/usr/bin/env bash
# Shared library for displaying App banners
# shellcheck shell=bash

bashio::app.print_banner() {
	local App_version
	App_version=$(bashio::app.version 2>/dev/null || bashio::addon.version 2>/dev/null) || App_version="unknown"
	[[ -z "$App_version" ]] && App_version="unknown"

	bashio::log.blue " \n"
	bashio::log.blue "-----------------------------------------------------------"
	bashio::log.blue " 📦 FaserF's App Repository"
	bashio::log.blue " 🔗 GitHub: https://github.com/FaserF/hassio-addons"
	bashio::log.blue "-----------------------------------------------------------\n"

	# Restart Loop Protection (Max 3 consecutive failed starts)
	if [ -z "${_BOOT_LOOP_CHECKED:-}" ] && [ -d "/data" ]; then
		export _BOOT_LOOP_CHECKED=1
		local STATE_FILE="/data/.boot_loop_protection"
		local LAST_VER=""
		local FAIL_COUNT=0

		if [ -f "$STATE_FILE" ]; then
			LAST_VER=$(head -n 1 "$STATE_FILE" 2>/dev/null)
			FAIL_COUNT=$(sed -n '2p' "$STATE_FILE" 2>/dev/null)
			FAIL_COUNT="${FAIL_COUNT//[!0-9]/}"
			[[ -z "$FAIL_COUNT" ]] && FAIL_COUNT=0
		fi

		if [ "$App_version" != "$LAST_VER" ]; then
			FAIL_COUNT=0
			LAST_VER="$App_version"
		fi

		FAIL_COUNT=$((FAIL_COUNT + 1))

		if [ "$FAIL_COUNT" -gt 3 ]; then
			bashio::log.error "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
			bashio::log.error "🚨 RESTART LOOP DETECTED!"
			bashio::log.error "⚠️  This App has failed to start 3 times consecutively."
			bashio::log.error "⚠️  Stopping App to prevent an endless restart loop."
			bashio::log.error "💡 Update the App or fix configuration issues to try again."
			bashio::log.error "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

			printf "%s\n0\n" "$App_version" >"$STATE_FILE" 2>/dev/null

			if type bashio::app.stop >/dev/null 2>&1; then
				bashio::app.stop 2>/dev/null || true
			elif type bashio::addon.stop >/dev/null 2>&1; then
				bashio::addon.stop 2>/dev/null || true
			fi
			sleep 3600
			exit 0
		fi

		printf "%s\n%s\n" "$App_version" "$FAIL_COUNT" >"$STATE_FILE" 2>/dev/null

		(
			sleep 120
			if [ -d "/data" ]; then
				printf "%s\n0\n" "$App_version" >"/data/.boot_loop_protection" 2>/dev/null
			fi
		) &
	fi

	# Version Checks
	if [[ "$App_version" == *"dev"* ]]; then
		bashio::log.warning "⚠️  You are running a Development Build ($App_version)!"
		bashio::log.warning "⚠️  This version may be unstable and contain bugs."
	elif [[ "$App_version" =~ ^0\.[01]\. ]]; then
		bashio::log.warning "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
		bashio::log.warning "⚠️  EARLY DEVELOPMENT VERSION ($App_version)"
		bashio::log.warning "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
		bashio::log.warning "This App is in early development and may not have a"
		bashio::log.warning "stable release yet. Installation might fail!"
		bashio::log.warning "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
	elif [[ "$App_version" =~ ^0\. ]]; then
		bashio::log.info "🚧  You are running a BETA version ($App_version)."
	fi

	bashio::log.blue "-----------------------------------------------------------"
	bashio::log.info "ℹ️  Disclaimer: Not all errors are App-related."
	bashio::log.info "ℹ️  Some issues may originate from the software itself."
	bashio::log.blue "-----------------------------------------------------------\n"
}
