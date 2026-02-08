#!/usr/bin/with-contenv bashio
# Shared library for displaying App banners

# shellcheck shell=bash

bashio::app.print_banner() {
	local app_version
	app_version=$(bashio::addon.version)

	# Load Baileys version from environment file
	if [ -f /etc/environment ]; then
		# shellcheck disable=SC1091
		source /etc/environment 2>/dev/null || true
	fi

	bashio::log.blue " \n"
	bashio::log.blue "-----------------------------------------------------------"
	bashio::log.blue " 📦 FaserF's App Repository"
	bashio::log.blue " 🔗 GitHub: https://github.com/FaserF/hassio-addons"
	bashio::log.blue "-----------------------------------------------------------"

	# Software version
	if [ -n "${BAILEYS_VERSION:-}" ]; then
		bashio::log.info "🔧 Baileys Version: ${BAILEYS_VERSION}"
	fi
	bashio::log.blue "-----------------------------------------------------------\n"

	# Version Checks
	if [[ "$app_version" == *"dev"* ]]; then
		bashio::log.warning "⚠️  You are running a Development Build ($app_version)!"
		bashio::log.warning "⚠️  This version may be unstable and contain bugs."
	elif [[ "$app_version" =~ ^0\. ]]; then
		bashio::log.info "🚧  You are running a BETA version ($app_version)."
	fi

	bashio::log.blue "-----------------------------------------------------------"
	bashio::log.info "ℹ️  Disclaimer: Not all errors are App-related."
	bashio::log.info "ℹ️  Some issues may originate from the software itself."
	bashio::log.blue "-----------------------------------------------------------\n"
}
