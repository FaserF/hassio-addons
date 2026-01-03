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
	bashio::log.blue "-----------------------------------------------------------"

	# Software version
	local apache_ver
	local php_ver
	apache_ver=$(httpd -v 2>/dev/null | head -n1 | cut -d' ' -f3 | cut -d'/' -f2)
	php_ver=$(php -v 2>/dev/null | head -n1 | cut -d' ' -f2)

	if [ -n "$apache_ver" ]; then
		bashio::log.info "🔧 Apache Version: ${apache_ver}"
	fi
	if [ -n "$php_ver" ]; then
		bashio::log.info "🔧 PHP Version: ${php_ver}"
	fi
	bashio::log.blue "-----------------------------------------------------------\n"

	# Version Checks
	if [[ "$addon_version" == *"dev"* ]]; then
		bashio::log.warning "⚠️  You are running a Development Build ($addon_version)!"
		bashio::log.warning "⚠️  This version may be unstable and contain bugs."
	elif [[ "$addon_version" =~ ^0\. ]]; then
		bashio::log.info "🚧  You are running a BETA version ($addon_version)."
	fi

	bashio::log.blue "-----------------------------------------------------------"
	bashio::log.info "ℹ️  Disclaimer: Not all errors are addon-related."
	bashio::log.info "ℹ️  Some issues may originate from the software itself."
	bashio::log.blue "-----------------------------------------------------------\n"
}
