#!/usr/bin/env bashio
ssl=$(bashio::config 'ssl')
mariadb_filename=$(bashio::config 'mariadb_filename')
mariadb_username=$(bashio::config 'mariadb_username')
mariadb_username=$(bashio::config 'mariadb_username')

if [ -d /var/www/localhost/htdocs/ ]; then
    rm -r /var/www/localhost/htdocs/
    #Create Shortcut to shared html folder
    ln -s /share/htdocs /var/www/localhost/
fi

if [ $ssl = "true" ]; then
    echo "You have activated SSL. SSL Settings will be applied"
    a2enmod ssl
else
    echo "SSL is deactivated"
fi

#if bashio::config.has_value 'mariadb_filename'; then
if [ $mariadb_filename != "off" ]; then
    echo "mariadb file was given, preparing mariadb"
    if ! bashio::services.available 'mysql'; then
        bashio::log.fatal \
        "Local database access should be provided by the MariaDB addon"
        bashio::exit.nok \
        "Please ensure it is installed and started"
    fi
    host=$(bashio::services "mysql" "host")
    password=$(bashio::services "mysql" "password")
    port=$(bashio::services "mysql" "port")
    username=$(bashio::services "mysql" "username")

    bashio::log.warning "Using the Maria DB addon"
    bashio::log.warning "Please ensure this is included in your backups"
    bashio::log.warning "Uninstalling the MariaDB addon will remove any data"

    bashio::log.info "Creating database $mariadb_filename on MariaDB Addon $host if required"
    mysql \
        -u "${username}" -p"${password}" \
        -h "${host}" -P "${port}" \
        -e "CREATE DATABASE IF NOT EXISTS \`$mariadb_filename\` ;"
    if [ -f /share/$mariadb_filename.sql ]; then
    bashio::log.info "Listing current Tables of $mariadb_filename Database with user ${username}"
    mysql \
        -u "${username}" -p"${password}" \
        -h "${host}" -P "${port}" \
        -e "SHOW TABLES FROM $mariadb_filename ;"
    bashio::log.info "Importing file  /share/$mariadb_filename.sql on MariaDB Addon $host with user ${username}"
    mysql \
        -u "${username}" -p"${password}" \
        -h "${host}" -P "${port}" \
        -e "--database=$mariadb_filename < /share/$mariadb_filename.sql ;"
    else
    bashio::log.warning "File /share/$mariadb_filename.sql not found! Skipping MariaDB import."
    fi
else
    echo "no mariadb file was given. Mariadb wont be set up."
fi

echo "Here is your web file architecture."
ls -l /var/www/localhost/htdocs/

echo "Starting Apache2 - This is the last message in the log. If no error occured your web server should work."
exec /usr/sbin/httpd -D FOREGROUND