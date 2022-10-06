#!/usr/bin/with-contenv bashio
ssl=$(bashio::config 'ssl')
certfile=$(bashio::config 'certfile')
keyfile=$(bashio::config 'keyfile')
password_mariadb=$(bashio::config 'password')
db=panel

echo "This add-on requires the MariaDB core add-on 2.0 or newer!"

host=$(bashio::services "mysql" "host")
password=$(bashio::services "mysql" "password")
port=$(bashio::services "mysql" "port")
username=$(bashio::services "mysql" "username")

#Drop database based on config flag
if bashio::config.true 'reset_database'; then
	bashio::log.warning 'Recreating database'
	echo "DROP DATABASE IF EXISTS wiki;" |
		mysql -h "${host}" -P "${port}" -u "${username}" -p"${password}"

	#Remove reset_database option
	bashio::addon.option 'reset_database'
fi

if mysql "${db}" >/dev/null 2>&1 </dev/null
then
  echo "${db} database exists skipping initial setup"
else
	echo "${db} database does not exist, creating it now"
	echo "CREATE USER IF NOT EXISTS 'pterodactyl'' IDENTIFIED BY '${password_mariadb}';" |
		mysql -h "${host}" -P "${port}" -u "${username}" -p"${password}"
	CREATE DATABASE IF NOT EXISTS panel;
	GRANT ALL PRIVILEGES ON panel.* TO 'pterodactyl' WITH GRANT OPTION;

	php artisan key:generate --force
	php artisan migrate --seed --force

fi

echo "Starting pterodactyl..."
exec /usr/bin/php /var/www/pterodactyl/artisan queue:work --queue=high,standard,low --sleep=3 --tries=3
