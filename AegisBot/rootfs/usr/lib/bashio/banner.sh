#!/usr/bin/with-contenv bashio
# Shared library for displaying App banners

# shellcheck shell=bash

bashio::app.print_banner() {
	local App_version
	App_version=$(bashio::addon.version)

	bashio::log.blue " \n"
	bashio::log.blue "-----------------------------------------------------------"
	bashio::log.blue " 📦 FaserF's App Repository"
	bashio::log.blue " 🔗 GitHub: https://github.com/FaserF/hassio-addons"
	bashio::log.blue "-----------------------------------------------------------"

	# Software version
	if [ -n "${AEGISBOT_VERSION:-}" ]; then
		bashio::log.info "🔧 AegisBot Version: ${AEGISBOT_VERSION}"
	fi
	bashio::log.blue "-----------------------------------------------------------\n"

	# Version Checks
	if [[ "$App_version" == *"dev"* ]]; then
		bashio::log.warning "⚠️  You are running a Development Build ($App_version)!"
		bashio::log.warning "⚠️  This version may be unstable and contain bugs."
	elif [[ "$App_version" =~ ^0\. ]]; then
		bashio::log.info "🚧  You are running a BETA version ($App_version)."
	fi

	bashio::log.blue "-----------------------------------------------------------"
	bashio::log.info "ℹ️  Disclaimer: Not all errors are App-related."
	bashio::log.info "ℹ️  Some issues may originate from the software itself."
	bashio::log.blue "-----------------------------------------------------------\n"
}
