#!/usr/bin/with-contenv bashio
ssl=$(bashio::config 'ssl')
certfile=$(bashio::config 'certfile')
keyfile=$(bashio::config 'keyfile')

declare host
declare password
declare port
declare username

# Require MySQL service to be available
#if ! bashio::services.available "mysql"; then
#    bashio::log.error \
#        "This add-on requires the MariaDB core add-on 2.0 or newer!"
#    bashio::exit.nok \
#        "Make sure the MariaDB add-on is installed and running"
#fi
echo "This add-on requires the MariaDB core add-on 2.0 or newer!"

host=$(bashio::services "mysql" "host")
#password=$(bashio::services "mysql" "password")
#port=$(bashio::services "mysql" "port")
#username=$(bashio::services "mysql" "username")

#Drop database based on config flag
if bashio::config.true 'reset_database'; then
    bashio::log.warning 'Recreating database'
    echo "DROP DATABASE IF EXISTS ttrss;" \
    | mysql -h "${host}" -P "${port}" -u "${username}" -p"${password}"

    #Remove reset_database option
    bashio::addon.option 'reset_database'
fi

if [ $ssl = "true" ]; then
    echo "You have activated SSL. SSL Settings will be applied"
    if [ ! -f /ssl/$certfile ]; then
      echo "Cannot find certificate file $certfile"
      exit 1
    fi
    if [ ! -f /ssl/$keyfile ]; then
      echo "Cannot find certificate key file $keyfile"
      exit 1
    fi
    echo "server {" > /etc/nginx/sites-available/ttrss
    echo "	listen 80;" >> /etc/nginx/sites-available/ttrss
    echo "	listen 443 ssl;" >> /etc/nginx/sites-available/ttrss
    echo "	root /var/www;" >> /etc/nginx/sites-available/ttrss
    echo "ssl_certificate     $certfile;" >> /etc/nginx/sites-available/ttrss
    echo "ssl_certificate_key $keyfile;" >> /etc/nginx/sites-available/ttrss
    echo "}" >> /etc/nginx/sites-available/ttrss
else
    echo "server {" > /etc/nginx/sites-available/ttrss
    echo "	listen 80;" >> /etc/nginx/sites-available/ttrss
    echo "	root /var/www;" >> /etc/nginx/sites-available/ttrss
    echo "}" >> /etc/nginx/sites-available/ttrss
fi

#Create Config file
echo "<?php" > /var/www/config.php
echo "	/*" >> /var/www/config.php
echo "		putenv('TTRSS_DB_HOST=${host}');" >> /var/www/config.php
echo "	*/" >> /var/www/config.php

# Create database if not exists
#echo "CREATE DATABASE IF NOT EXISTS ttrss;" \
#    | mysql -h "${host}" -P "${port}" -u "${username}" -p"${password}"

echo "Starting Tiny Tiny RSS"
nginx -g 'daemon off;'
