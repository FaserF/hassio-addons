#!/usr/bin/with-contenv bashio
nginx_uid=abc
declare nginx_port
nginx_port=$(bashio::addon.port 85)
dhcp_range=$(bashio::config 'dhcp_range')
path=$(bashio::config 'path')
path_config=$(bashio::config 'path_config')

#echo "Port: $nginx_port"

echo "Creating user $nginx_uid and setting permissions..."

# Set the uid:gid to run as
adduser --disabled-password --system --no-create-home $nginx_uid
addgroup $nginx_uid
adduser $nginx_uid $nginx_uid
adduser $nginx_uid nginx

echo "Generating nginx config..."
if bashio::var.has_value "${nginx_port}"; then
	echo "server {" >/defaults/default
	echo "	listen $nginx_port;" >>/defaults/default
	echo "	location / {" >>/defaults/default
	echo "		root /assets;" >>/defaults/default
	echo "		autoindex on;" >>/defaults/default
	echo "	}" >>/defaults/default
	echo "}" >>/defaults/default
else
	echo "Nginx port was not set! Setting 85 as default!"
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

if [ ! -d $path ]; then
	echo "Looks like the path $path did not exist! We will create it. Copy your installations ISOs etc there."
	mkdir -p $path
fi
ln -s $path /assets
if [ ! -d $path_config ]; then
	echo "Looks like the path $path_config did not exist! We will still start the addon with default options!"
	mkdir -p $path_config
fi
ln -s $path_config /config

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
