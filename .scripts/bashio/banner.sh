#!/usr/bin/with-contenv bashio
# Shared library for displaying add-on banners

# shellcheck shell=bash

bashio::addon.print_banner() {
	local addon_version
	addon_version=$(bashio::addon.version)

	bashio::log.blue " \n"
	bashio::log.blue "-----------------------------------------------------------"
	bashio::log.blue " 📦 FaserF's Addon Repository"
	bashio::log.blue " 🔗 GitHub: https://github.com/FaserF/hassio-addons"
	bashio::log.blue "-----------------------------------------------------------\n"

	# Version Checks with granular early development detection
	if [[ "$addon_version" == *"dev"* ]]; then
		bashio::log.warning "⚠️  You are running a Development Build ($addon_version)!"
		bashio::log.warning "⚠️  This version may be unstable and contain bugs."
	elif [[ "$addon_version" =~ ^0\.[01]\. ]]; then
		# 0.0.X or 0.1.X = Early development, might not have stable release
		bashio::log.warning "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
		bashio::log.warning "⚠️  EARLY DEVELOPMENT VERSION ($addon_version)"
		bashio::log.warning "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
		bashio::log.warning "This add-on is in early development and may not have a"
		bashio::log.warning "stable release yet. Installation might fail!"
		bashio::log.warning ""
		bashio::log.warning "💡 If installation fails, try the EDGE branch instead:"
		bashio::log.warning "   Add repository: https://github.com/FaserF/hassio-addons-edge"
		bashio::log.warning "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
	elif [[ "$addon_version" =~ ^0\. ]]; then
		# 0.2.X and above = Beta, but more stable
		bashio::log.info "🚧  You are running a BETA version ($addon_version)."
	fi

	bashio::log.blue "-----------------------------------------------------------"
	bashio::log.info "ℹ️  Disclaimer: Not all errors are addon-related."
	bashio::log.info "ℹ️  Some issues may originate from the software itself."
	bashio::log.blue "-----------------------------------------------------------\n"
}
