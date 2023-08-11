#!/usr/bin/with-contenv bashio

if [ -f /run-pre.sh ]; then
    /run-pre.sh
fi

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

# Start php-fpm
mkdir -p /usr/logs/php-fpm
php-fpm7

# Start nginx
mkdir -p /usr/logs/nginx
mkdir -p /tmp/nginx
chown nginx /tmp/nginx
nginx
