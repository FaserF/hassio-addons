#!/usr/bin/with-contenv bashio
#!/bin/sh

[ -f /run-pre.sh ] && /run-pre.sh

if [ ! -d /usr/html ]; then
	echo "[i] Creating directories..."
	mkdir -p /usr/html
	echo "[i] Fixing permissions..."
	chown -R nginx:nginx /usr/html
else
	echo "[i] Fixing permissions..."
	chown -R nginx:nginx /usr/html
fi

chown -R nginx:www-data /usr/html

# start php-fpm
mkdir -p /usr/logs/php-fpm
php-fpm7

# start nginx
mkdir -p /usr/logs/nginx
mkdir -p /tmp/nginx
chown nginx /tmp/nginx
nginx
