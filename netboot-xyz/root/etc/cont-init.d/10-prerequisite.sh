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
nginx_port=$(bashio::addon.port 85)
tftp_port=$(bashio::addon.port "69/udp")
dhcp_range=$(bashio::config 'dhcp_range')
path=$(bashio::config 'path')
path_config=$(bashio::config 'path_config')

# Validate critical ports for PXE boot
if bashio::var.has_value "${nginx_port}" && [ "${nginx_port}" != "85" ]; then
	bashio::log.warning "NGINX port changed from 85 to ${nginx_port}!"
	bashio::log.warning "PXE boot clients expect assets on port 85. This may cause boot failures!"
fi

if bashio::var.has_value "${tftp_port}" && [ "${tftp_port}" != "69" ]; then
	bashio::log.warning "TFTP port changed from 69 to ${tftp_port}!"
	bashio::log.warning "PXE boot requires TFTP on port 69. Network boot will NOT work!"
fi

echo "Creating user $nginx_uid and setting permissions..."

# Set the uid:gid to run as
adduser --disabled-password --system --no-create-home "$nginx_uid"
addgroup "$nginx_uid"
adduser "$nginx_uid" "$nginx_uid"
adduser "$nginx_uid" nginx

echo "Generating nginx config..."
if bashio::var.has_value "${nginx_port}"; then
	bashio::log.info "Using NGINX port: ${nginx_port}"
	echo "server {" >/defaults/default
	echo "	listen ${nginx_port};" >>/defaults/default
	echo "	location / {" >>/defaults/default
	echo "		root /assets;" >>/defaults/default
	echo "		autoindex on;" >>/defaults/default
	echo "	}" >>/defaults/default
	echo "}" >>/defaults/default
else
	bashio::log.info "NGINX port not mapped externally, using default port 85"
	echo "server {" >/defaults/default
	echo "	listen 85;" >>/defaults/default
	echo "	location / {" >>/defaults/default
	echo "		root /assets;" >>/defaults/default
	echo "		autoindex on;" >>/defaults/default
	echo "	}" >>/defaults/default
	echo "}" >>/defaults/default
fi

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
