#!/usr/bin/with-contenv bashio
ssl=$(bashio::config 'ssl')
SSL_CERT=/ssl/$(bashio::config 'certfile')
SSL_CERT_KEY=/ssl/$(bashio::config 'keyfile')
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

if mysql "${db}" >/dev/null 2>&1 </dev/null; then
	echo "${db} database exists skipping initial setup"
else
	echo "${db} database does not exist, creating it now"
	#echo "CREATE USER IF NOT EXISTS 'pterodactyl'' IDENTIFIED BY '${password_mariadb}';" |
	#	mysql -h "${host}" -P "${port}" -u "${username}" -p"${password}"
	echo "CREATE DATABASE IF NOT EXISTS ${db};" |
		mysql -h "${host}" -P "${port}" -u "${username}" -p"${password}"
	echo "GRANT ALL PRIVILEGES ON ${db}.* TO 'pterodactyl' WITH GRANT OPTION;" |
		mysql -h "${host}" -P "${port}" -u "${username}" -p"${password}"
fi

if [ $host = "localhost" ]; then
	host=127.0.0.1
fi

cd /var/www/html/

echo "[setup] Comparing environment settings file from /share/pterodactyl/.env"
setup_user=false
if [ ! -d /share/pterodactyl/ ]; then
	mkdir /share/pterodactyl/
fi
if [ ! -f /share/pterodactyl/.env ]; then
	echo "No old config file found, starting first setup of pterodactyl"
	echo "[setup] Generating Application Key..."
	php81 artisan key:generate --no-interaction --force
	echo "[setup] Application Key Generated"
	cp .env /share/pterodactyl/.env
	setup_user=true
else
	echo "config file exists, skipping first setup of pterodactyl and using existing config from /share/pterodactyl/.env"
	cp /share/pterodactyl/.env .env
fi

echo ""
echo "[setup] Clearing cache/views..."

php81 artisan view:clear
php81 artisan config:clear

echo ""
echo "[setup] Setup database credentials..."
php81 artisan p:environment:database --host "${host}" --port "${port}" --username "pterodactyl" --password "${password_mariadb}"

if [ $setup_user = "true" ]; then
	echo "[setup] Migrating/Seeding database..."
	php81 artisan migrate --seed --no-interaction --force
fi

if [ ! -f /share/pterodactyl/nginx_default.conf ]; then
	# Checks if SSL certificate and key exists, otherwise default to http traffic
	if bashio::config.true 'ssl'; then
		echo "[setup] SSL has been enabled. Setting nginx settings for ssl usage with ${SSL_CERT},${SSL_CERT_KEY}."
		envsubst '${SSL_CERT},${SSL_CERT_KEY}' \
			</etc/nginx/templates/https.conf >/etc/nginx/conf.d/default.conf
	else
		echo "[setup] Warning: SSL Certificate was not specified or doesnt exist, using HTTP."
		cat /etc/nginx/templates/http.conf >/etc/nginx/conf.d/default.conf
	fi
	cp /etc/nginx/conf.d/default.conf /share/pterodactyl/nginx_default.conf
else
	cp /share/pterodactyl/nginx_default.conf /etc/nginx/conf.d/default.conf
fi

echo "[start] Starting nginx and php - afterwards Pterodactyl will be started"
#chown -R nginx:nginx /var/www/html/
# Restore /data directory ownership to nginx.
if [ ! -d /data/storage/logs/ ]; then
	mkdir -p /data/storage/logs/
fi
#chown -R nginx:nginx /data/

# Run these as jobs and monitor their pid status
/usr/sbin/php-fpm81 --nodaemonize -c /etc/php81 &
php_service_pid=$!
/usr/sbin/nginx -g "daemon off;" &
nginx_service_pid=$!

if [ $setup_user = "true" ]; then
	echo "[setup] Creating default user..."
	php81 artisan p:user:make --admin "1" --email "admin@example.com" --username "admin" --name-first "Default" --name-last "Admin" --password "${password_mariadb}"

	echo "For the first login use admin@example.com / admin as user and your database password to sign in."
	echo "Please ensure to change these credentials as soon as possible."
fi

echo "[start] Starting Pterodactyl Panel"

## Start ##
exec php81 /var/www/html/artisan queue:work --queue=high,standard,low --sleep=3 --tries=3
#exec tail -f /var/log/nginx/pterodactyl.app-error.log
