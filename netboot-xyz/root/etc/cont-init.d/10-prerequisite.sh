#!/usr/bin/with-contenv bashio
nginx_uid=abc
declare nginx_port
nginx_port=$(bashio::addon.port 80)

echo "Port: $nginx_port"

echo "Creating user $nginx_uid and setting permissions..."

# Set the uid:gid to run as
adduser --disabled-password --system --no-create-home $nginx_uid
addgroup $nginx_uid
adduser $nginx_uid $nginx_uid
adduser $nginx_uid nginx

echo "Generating nginx config..."
if bashio::var.has_value "${nginx_port}"; then
    echo "server {" > /defaults/default
    echo "	listen $nginx_port;" >> /defaults/default
    echo "	location / {" >> /defaults/default
    echo "		root /assets;" >> /defaults/default
    echo "		autoindex on;" >> /defaults/default
    echo "	}" >> /defaults/default
    echo "}" >> /defaults/default
else
    echo "Nginx port was not set! Setting 85 as default!"
    echo "server {" > /defaults/default
    echo "	listen 85;" >> /defaults/default
    echo "	location / {" >> /defaults/default
    echo "		root /assets;" >> /defaults/default
    echo "		autoindex on;" >> /defaults/default
    echo "	}" >> /defaults/default
    echo "}" >> /defaults/default
fi