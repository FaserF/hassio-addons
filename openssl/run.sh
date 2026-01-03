#!/usr/bin/env bashio

# Enable strict mode
set -e
# shellcheck disable=SC1091

# Configuration
website_name=$(bashio::config 'website_name')
key_file=/ssl/key_openssl.pem
cert_file=/ssl/cert_openssl.pem

# Certificate settings
KEY_BITS=4096
VALID_DAYS=10000

bashio::log.info "=============================================="
bashio::log.info "        OpenSSL Certificate Generator         "
bashio::log.info "=============================================="
bashio::log.info ""
bashio::log.info "Configuration:"
bashio::log.info "  Common Name (CN):  ${website_name}"
bashio::log.info "  Key Size:          ${KEY_BITS} bit RSA"
bashio::log.info "  Validity:          ${VALID_DAYS} days (~27 years)"
bashio::log.info "  Key File:          ${key_file}"
bashio::log.info "  Certificate File:  ${cert_file}"
bashio::log.info ""

# Check and remove existing files
if test -f "$key_file"; then
	bashio::log.notice "Existing key file found: ${key_file}"
	bashio::log.notice "Removing old key file..."
	rm "$key_file"
fi

if test -f "$cert_file"; then
	bashio::log.notice "Existing certificate found: ${cert_file}"
	bashio::log.notice "Removing old certificate..."
	rm "$cert_file"
fi

# Generate certificate
bashio::log.info "Generating new self-signed certificate..."
bashio::log.info "(This may take a moment...)"
bashio::log.info ""

# Run openssl with quiet output, redirecting progress to /dev/null
if openssl req -x509 -newkey rsa:${KEY_BITS} -keyout "$key_file" -out "$cert_file" -days ${VALID_DAYS} -nodes -subj "/CN=$website_name" 2>/dev/null; then
	bashio::log.info ""
	bashio::log.info "=============================================="
	bashio::log.info "  ✓ Certificate generated successfully!"
	bashio::log.info "=============================================="
	bashio::log.info ""
	bashio::log.info "Output files:"
	bashio::log.info "  Private Key:   ${key_file}"
	bashio::log.info "  Certificate:   ${cert_file}"
	bashio::log.info ""

	# Show certificate info
	bashio::log.info "Certificate details:"
	cert_info=$(openssl x509 -in "$cert_file" -noout -subject -dates 2>/dev/null || true)
	if [ -n "$cert_info" ]; then
		echo "$cert_info" | while read -r line; do
			bashio::log.info "  $line"
		done
	fi
	bashio::log.info ""
	bashio::log.info "You can now use these files in your Home Assistant configuration."
	bashio::log.info "Example for configuration.yaml:"
	bashio::log.info ""
	bashio::log.info "  http:"
	bashio::log.info "    ssl_certificate: /ssl/cert_openssl.pem"
	bashio::log.info "    ssl_key: /ssl/key_openssl.pem"
	bashio::log.info ""
	bashio::log.info "The add-on will now stop."
else
	bashio::log.error "Failed to generate certificate!"
	exit 1
fi

exit 0
