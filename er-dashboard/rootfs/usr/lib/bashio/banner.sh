#!/usr/bin/with-contenv bashio
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

	# Version Checks with granular early development detection
	if [[ "$App_version" == *"dev"* ]]; then
		bashio::log.warning "⚠️  You are running a Development Build ($App_version)!"
		bashio::log.warning "⚠️  This version may be unstable and contain bugs."
	elif [[ "$App_version" =~ ^0\.[01]\. ]]; then
		# 0.0.X or 0.1.X = Early development, might not have stable release
		bashio::log.warning "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
		bashio::log.warning "⚠️  EARLY DEVELOPMENT VERSION ($App_version)"
		bashio::log.warning "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
		bashio::log.warning "This App is in early development and may not have a"
		bashio::log.warning "stable release yet. Installation might fail!"
		bashio::log.warning ""
		bashio::log.warning "💡 If installation fails, try the EDGE branch instead:"
		bashio::log.warning "   Add repository: https://github.com/FaserF/hassio-addons-edge"
		bashio::log.warning "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
	elif [[ "$App_version" =~ ^0\. ]]; then
		# 0.2.X and above = Beta, but more stable
		bashio::log.info "🚧  You are running a BETA version ($App_version)."
	fi

	bashio::log.blue "-----------------------------------------------------------"
	bashio::log.info "ℹ️  Disclaimer: Not all errors are App-related."
	bashio::log.info "ℹ️  Some issues may originate from the software itself."
	bashio::log.blue "-----------------------------------------------------------\n"
}
