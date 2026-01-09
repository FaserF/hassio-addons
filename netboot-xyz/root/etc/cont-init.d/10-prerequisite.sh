#!/usr/bin/with-contenv bashio
# shellcheck disable=SC2034,SC2129,SC2016
# shellcheck shell=bash

# Check if protection mode is disabled - this addon requires full system access
if bashio::addon.protected; then
	touch /run/ABORT_STARTUP
	bashio::require.unprotected
fi

nginx_uid=abc
declare nginx_port
declare tftp_port
# Force ports to required values for host_network mode
# These ports MUST remain fixed: 85 (NGINX), 3000 (Web UI), 69 (TFTP)
nginx_port=85
tftp_port=69
dhcp_range=$(bashio::config 'dhcp_range')
path=$(bashio::config 'path')
path_config=$(bashio::config 'path_config')

# Validate that ports are not changed (critical for host_network mode)
CONFIGURED_NGINX_PORT=$(bashio::addon.port 85 2>/dev/null || echo "85")
CONFIGURED_TFTP_PORT=$(bashio::addon.port "69/udp" 2>/dev/null || echo "69")

if [ "${CONFIGURED_NGINX_PORT}" != "85" ]; then
	bashio::log.error "NGINX port must be 85 for host_network mode! Current: ${CONFIGURED_NGINX_PORT}"
	bashio::log.error "PXE boot requires port 85. Please set port mapping to '85: 85' in config."
	exit 1
fi

if [ "${CONFIGURED_TFTP_PORT}" != "69" ]; then
	bashio::log.error "TFTP port must be 69 for host_network mode! Current: ${CONFIGURED_TFTP_PORT}"
	bashio::log.error "PXE boot requires port 69. Please set port mapping to '69/udp: 69' in config."
	exit 1
fi

bashio::log.info "Ports validated: NGINX=85, TFTP=69, Web UI=3000 (all fixed for host_network mode)"

echo "Creating user $nginx_uid and setting permissions..."

# Set the uid:gid to run as
adduser --disabled-password --system --no-create-home "$nginx_uid"
addgroup "$nginx_uid"
adduser "$nginx_uid" "$nginx_uid"
adduser "$nginx_uid" nginx

echo "Generating nginx config..."
# Always use port 85 (fixed for host_network mode and PXE boot requirements)
bashio::log.info "Using NGINX port: 85 (fixed for host_network mode)"
echo "server {" >/defaults/default
echo "	listen 85;" >>/defaults/default
echo "	location / {" >>/defaults/default
echo "		root /assets;" >>/defaults/default
echo "		autoindex on;" >>/defaults/default
echo "	}" >>/defaults/default
echo "}" >>/defaults/default

echo "Linking folder $path to /assets and $path_config to /config."

if [ -d /assets ]; then
	echo "assets exists"
	ls -l /assets
fi
if [ -d /assets/netboot-image ]; then
	echo "/assets/netboot-image exists"
	ls -l /assets/netboot-image
fi
if [ -d /config ]; then
	echo "/config exists"
	ls -l /config
fi

if [ ! -d "$path" ]; then
	echo "Looks like the path $path did not exist! We will create it. Copy your installations ISOs etc there."
	mkdir -p "$path"
fi
if [ -L /assets ]; then rm /assets; elif [ -d /assets ]; then rm -rf /assets; else rm -f /assets; fi
ln -s "$path" /assets
if [ ! -d "$path_config" ]; then
	echo "Looks like the path $path_config did not exist! We will still start the addon with default options!"
	mkdir -p "$path_config"
fi
if [ -L /config ]; then
	rm /config
elif [ -d /config ]; then
	# Check if /config is a mount
	if grep -q " /config " /proc/mounts; then
		echo "Info: /config is a mount, skipping replacement with symlink."
	else
		echo "Info: Removing existing /config directory to replace with symlink..."
		rm -rf /config
	fi
else
	rm -f /config
fi

if [ ! -e /config ]; then
	ln -s "$path_config" /config
fi

if [ ! -d /config/menus ]; then
	mkdir /config/menus
fi

#Setup dnsmasq
if [ ! -d /etc/dnsmasq.d ]; then
	/bin/mkdir /etc/dnsmasq.d
fi
cp /defaults/dnsmasq.conf /etc/dnsmasq.d/dnsmasq.conf

echo $'\n' >>/etc/dnsmasq.d/dnsmasq.conf
echo "dhcp-range=$dhcp_range,proxy" >>/etc/dnsmasq.d/dnsmasq.conf
