#!/usr/bin/with-contenv bashio
ssl=$(bashio::config 'ssl')
certfile=$(bashio::config 'certfile')
keyfile=$(bashio::config 'keyfile')
log_level=$(bashio::config 'log_level')

declare host
declare password
declare port
declare username

# Require MySQL service to be available
if ! bashio::services.available "mysql"; then
    bashio::log.error \
        "This add-on requires the MariaDB core add-on 2.0 or newer!"
    bashio::exit.nok \
        "Make sure the MariaDB add-on is installed and running"
fi

host=$(bashio::services "mysql" "host")
password=$(bashio::services "mysql" "password")
port=$(bashio::services "mysql" "port")
username=$(bashio::services "mysql" "username")

#Drop database based on config flag
if bashio::config.true 'reset_database'; then
    bashio::log.warning 'Recreating database'
    echo "DROP DATABASE IF EXISTS wiki;" \
    | mysql -h "${host}" -P "${port}" -u "${username}" -p"${password}"

    #Remove reset_database option
    bashio::addon.option 'reset_database'
fi

#Create Config file
echo "port: 3000" > /wiki/config.yml
echo "db:" >> /wiki/config.yml
echo "  type: mariadb" >> /wiki/config.yml
echo "  host: ${host}" >> /wiki/config.yml
echo "  port: ${port}" >> /wiki/config.yml
echo "  user: ${username}" >> /wiki/config.yml
echo "  pass: ${password}" >> /wiki/config.yml
echo "  db: wiki" >> /wiki/config.yml
echo "ssl:" >> /wiki/config.yml
echo "  enabled: $ssl" >> /wiki/config.yml
echo "  port: 3443" >> /wiki/config.yml
echo "  provider: custom" >> /wiki/config.yml
echo "  format: pem" >> /wiki/config.yml
echo "  key: $keyfile" >> /wiki/config.yml
echo "  cert: $certfile" >> /wiki/config.yml
echo "pool:" >> /wiki/config.yml
echo "bindIP: 0.0.0.0" >> /wiki/config.yml
echo "logLevel: $log_level" >> /wiki/config.yml
echo "offline: false" >> /wiki/config.yml
echo "ha: false" >> /wiki/config.yml
echo "dataPath: ./data" >> /wiki/config.yml

# Create database if not exists
echo "CREATE DATABASE IF NOT EXISTS wiki;" \
    | mysql -h "${host}" -P "${port}" -u "${username}" -p"${password}"

echo "Starting Wiki.JS"
node server