#!/usr/bin/with-contenv bashio
ssl=$(bashio::config 'ssl')
SSL_CERT=/ssl/$(bashio::config 'certfile')
SSL_CERT_KEY=/ssl/$(bashio::config 'keyfile')
password_mariadb=$(bashio::config 'password')
config_file=$(bashio::config 'config_file')
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

#Create Shortcut to config file
echo "Using config file from ${config_file}..."
ln -s $config_file /etc/pterodactyl/config.yml

echo "Starting pterodactyl panel.."

# Runs the initial configuration on every startup
function startServer {
    echo ""
    cat .storage.tmpl | while read line; do
        mkdir -p "/data/${line}"
    done

    # Generate config file if it doesnt exist
    if [ ! -e /data/pterodactyl.conf ]; then
        echo ""
        echo "[setup] Generating Application Key..."

        # Generate base template
        touch /data/pterodactyl.conf
        echo "##" > /data/pterodactyl.conf
        echo "# Generated on:" $(date +"%B %d %Y, %H:%M:%S") >> /data/pterodactyl.conf
        echo "# This file was generated on first start and contains " >> /data/pterodactyl.conf
        echo "# the key for sensitive information. All panel configuration " >> /data/pterodactyl.conf
        echo "# can be done here using the normal method (NGINX not included!)," >> /data/pterodactyl.conf
        echo "# or using Docker's environment variables parameter." >> /data/pterodactyl.conf
        echo "##" >> /data/pterodactyl.conf
        echo "" >> /data/pterodactyl.conf
        echo "APP_KEY=SomeRandomString3232RandomString" >> /data/pterodactyl.conf

        sleep 1
        php artisan key:generate --force --no-interaction

        echo "[setup] Application Key Generated"
    fi
    echo ""
    echo "[setup] Clearing cache/views..."
    
    php artisan view:clear
    php artisan config:clear

    echo ""
    echo "[setup] Migrating/Seeding database..."

    php artisan migrate --seed --force

    # Restore /data directory ownership to nginx.
    chown -R nginx:nginx /data/
    
    # Checks if SSL certificate and key exists, otherwise default to http traffic
    if [ -f "${SSL_CERT}" ] && [ -f "${SSL_CERT_KEY}" ]; then
        envsubst '${SSL_CERT},${SSL_CERT_KEY}' \
        < /etc/nginx/templates/https.conf > /etc/nginx/conf.d/default.conf
    else
        echo "[setup] Warning: SSL Certificate was not specified or doesnt exist, using HTTP."
        cat /etc/nginx/templates/http.conf > /etc/nginx/conf.d/default.conf
    fi

    echo "--- Starting Pterodactyl Panel: ${VERSION} ---"

    # Run these as jobs and monitor their pid status
    /usr/sbin/php-fpm7 --nodaemonize -c /etc/php7 & php_service_pid=$!
    /usr/sbin/nginx -g "daemon off;" & nginx_service_pid=$!

    # Monitor Child Processes
    while ( true ); do
        if ! kill -0 "$php_service_pid" 2>/dev/null; then
            echo "[php] service is no longer running! exiting..."
            sleep 5
            wait "$php_service_pid";
            exit 1
        fi
        if ! kill -0 "$nginx_service_pid" 2>/dev/null; then
            echo "[nginx] service is no longer running! exiting..."
            sleep 5
            wait "$nginx_service_pid"; 
            exit 2
        fi
        sleep 1
    done;
}

## Start ##

case "${1}" in
    p:start)
        checkDatabase
        startServer
        ;;
    p:worker)
        checkDatabase
        exec php /var/www/html/artisan queue:work --queue=high,standard,low --sleep=3 --tries=3
        ;;
    p:cron)
        checkDatabase
        exec /usr/sbin/crond -f -l 0
        ;;
    *)
        exec ${@}
        ;;
esac