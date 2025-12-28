#!/usr/bin/env bashio

# Enable strict mode
set -e

# Get Addon Version
addon_version=$(bashio::addon.version)

# Banner Function
print_banner() {
    bashio::log.blue " \n"
    bashio::log.blue "-----------------------------------------------------------"
    bashio::log.blue " 📦 FaserF's Addon Repository"
    bashio::log.blue " 🔗 GitHub: https://github.com/FaserF/hassio-addons"
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

print_banner

website_name=$(bashio::config 'website_name')
key_file=/ssl/key_openssl.pem
cert_file=/ssl/cert_openssl.pem

if test -f "$key_file"; then
	echo "$key_file exists already. A new one will now be created!"
	rm "$key_file"
fi

if test -f "$cert_file"; then
	echo "$cert_file exists already. A new one will now be created!"
	rm "$cert_file"
fi

openssl req -x509 -newkey rsa:4096 -keyout "$key_file" -out "$cert_file" -days 10000 -nodes -subj "/CN=$website_name"

echo "Certificates were generated. They are now located here: $key_file & $cert_file . The addon will now be stopped."
exit
