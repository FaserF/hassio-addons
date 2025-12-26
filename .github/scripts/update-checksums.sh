#!/bin/bash
# Post-upgrade script for Renovate to automatically update SHA256 checksums
# This script is called by Renovate after updating version ARGs
# Usage: .github/scripts/update-checksums.sh <package> <version>
#
# Supported packages:
#   - pterodactyl-wings: Downloads binaries from GitHub releases and computes checksums
#   - matterbridge: Downloads source tarball and computes checksum
#   - netboot-xyz: Downloads source tarball and computes checksum for WebApp

set -euo pipefail

PACKAGE="$1"
VERSION="$2"

if [[ -z "$PACKAGE" || -z "$VERSION" ]]; then
	echo "Error: Missing arguments. Usage: $0 <package> <version>"
	exit 1
fi

log() {
	echo "[update-checksums] $*"
}

update_pterodactyl_wings() {
	local version="$1"
	local dockerfile="pterodactyl-wings/Dockerfile"

	log "Fetching checksums for pterodactyl/wings $version..."

	# Download binaries and compute checksums
	local amd64_checksum arm64_checksum

	amd64_checksum=$(curl -sL "https://github.com/pterodactyl/wings/releases/download/${version}/wings_linux_amd64" | sha256sum | cut -d' ' -f1)
	arm64_checksum=$(curl -sL "https://github.com/pterodactyl/wings/releases/download/${version}/wings_linux_arm64" | sha256sum | cut -d' ' -f1)

	if [[ -z "$amd64_checksum" || "$amd64_checksum" == *"Not Found"* ]]; then
		log "ERROR: Failed to download amd64 binary for $version"
		exit 1
	fi

	if [[ -z "$arm64_checksum" || "$arm64_checksum" == *"Not Found"* ]]; then
		log "ERROR: Failed to download arm64 binary for $version"
		exit 1
	fi

	log "AMD64 checksum: $amd64_checksum"
	log "ARM64 checksum: $arm64_checksum"

	# Update Dockerfile
	sed -i "s/ARG WINGS_SHA256_AMD64=.*/ARG WINGS_SHA256_AMD64=${amd64_checksum}/" "$dockerfile"
	sed -i "s/ARG WINGS_SHA256_ARM64=.*/ARG WINGS_SHA256_ARM64=${arm64_checksum}/" "$dockerfile"

	# Update version comment
	sed -i "s/# SHA256 checksums for version .*/# SHA256 checksums for version ${version} (from official release)/" "$dockerfile"

	log "Updated $dockerfile with new checksums"
}

update_matterbridge() {
	local version="$1"
	local dockerfile="matterbridge/Dockerfile"

	log "Fetching checksum for 42wim/matterbridge $version..."

	# Download source tarball and compute checksum
	local checksum
	checksum=$(curl -sL "https://github.com/42wim/matterbridge/archive/refs/tags/${version}.tar.gz" | sha256sum | cut -d' ' -f1)

	if [[ -z "$checksum" || "$checksum" == *"Not Found"* ]]; then
		log "ERROR: Failed to download source tarball for $version"
		exit 1
	fi

	log "Source checksum: $checksum"

	# Update Dockerfile
	sed -i "s/ARG MATTERBRIDGE_SHA256=.*/ARG MATTERBRIDGE_SHA256=\"${checksum}\"/" "$dockerfile"

	log "Updated $dockerfile with new checksum"
}

update_netboot_xyz() {
	local version="$1"
	local dockerfile="netboot-xyz/Dockerfile"

	log "Fetching checksum for netbootxyz/webapp $version..."

	# Download source tarball and compute checksum
	local checksum
	checksum=$(curl -sL "https://github.com/netbootxyz/webapp/archive/${version}.tar.gz" | sha256sum | cut -d' ' -f1)

	if [[ -z "$checksum" || "$checksum" == *"Not Found"* ]]; then
		log "ERROR: Failed to download source tarball for $version"
		exit 1
	fi

	log "Source checksum: $checksum"

	# Update Dockerfile
	sed -i "s/ARG NETBOOTXYZ_SHA256=.*/ARG NETBOOTXYZ_SHA256=\"${checksum}\"/" "$dockerfile"

	log "Updated $dockerfile with new checksum"
}

case "$PACKAGE" in
pterodactyl-wings | pterodactyl/wings)
	update_pterodactyl_wings "$VERSION"
	;;
matterbridge | 42wim/matterbridge)
	update_matterbridge "$VERSION"
	;;
netboot-xyz | netbootxyz/webapp)
	update_netboot_xyz "$VERSION"
	;;
*)
	log "Unknown package: $PACKAGE"
	log "Supported packages: pterodactyl-wings, matterbridge"
	exit 1
	;;
esac

log "Checksum update complete!"
