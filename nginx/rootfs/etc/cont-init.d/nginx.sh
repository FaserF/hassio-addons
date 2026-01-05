#!/usr/bin/with-contenv bashio
# shellcheck disable=SC2034,SC2129,SC2016
# shellcheck shell=bash

ssl=$(bashio::config 'ssl')
website_name=$(bashio::config 'website_name')
certfile=$(bashio::config 'certfile')
keyfile=$(bashio::config 'keyfile')
DocumentRoot=$(bashio::config 'document_root')
phpini=$(bashio::config 'php_ini')
username=$(bashio::config 'username')
password=$(bashio::config 'password')
default_conf=$(bashio::config 'default_conf')
default_ssl_conf=$(bashio::config 'default_ssl_conf')
webrootdocker=/var/www/localhost/htdocs/
phppath=/etc/php84/php.ini

if [ -z "$website_name" ] || [ "$website_name" = "null" ]; then
	website_name="web.local"
fi

if [ "$phpini" = "get_file" ]; then
	cp "$phppath" /share/nginxaddon_php.ini
	echo "You have requested a copy of the php.ini file. You will now find your copy at /share/nginxaddon_php.ini"
	echo "Addon will now be stopped. Please remove the config option and change it to the name of your new config file (for example /share/php.ini)"
	exit 0
fi

# ------------------------------------------------------------------------------
# Security Note: The following block executes custom initialization commands
# provided via the 'init_commands' configuration option.
# These commands are executed using 'eval', which allows for arbitrary code
# execution within the container environment.
#
# USERS MUST ONLY PROVIDE TRUSTED COMMANDS.
# No further sandboxing or sanitization is performed by the add-on.
# Reference: https://github.com/FaserF/hassio-addons/tree/master/nginx#security
# ------------------------------------------------------------------------------
if bashio::config.has_value 'init_commands'; then
	echo "Detected custom init commands. Running them now."
	while read -r cmd; do
		eval "${cmd}" ||
			bashio::exit.nok "Failed executing init command: ${cmd}"
	done <<<"$(bashio::config 'init_commands')"
fi

rm -rf "$webrootdocker"

if [ ! -d "$DocumentRoot" ]; then
	echo "You haven't put your website to $DocumentRoot"
	echo "A default website will now be used"
	mkdir -p "$webrootdocker"
	cp /index.html "$webrootdocker"
else
	#Create Shortcut to shared html folder
	ln -s "$DocumentRoot" /var/www/localhost/htdocs
fi

#Set rights to web folders and create user
if [ -d "$DocumentRoot" ]; then
	find "$DocumentRoot" -type d -exec chmod 755 {} \;
	if [ -n "$username" ] && [ -n "$password" ] && [ ! "$username" = "null" ] && [ ! "$password" = "null" ]; then
		if ! id "$username" &>/dev/null; then
			adduser -S "$username" -G www-data
		fi
		# Securely set password using stdin to avoid exposure in process list
		chpasswd <<EOF
${username}:${password}
EOF
		# Clear password variable immediately after use
		unset password
		chown -R "$username":www-data "$webrootdocker"
	else
		echo "No username and/or password was provided. Skipping account set up."
		if ! grep -q "^www-data:" /etc/group; then
			addgroup -S www-data
		fi
		if ! id www-data &>/dev/null; then
			adduser -S -G www-data www-data
		fi
		chown -R www-data:www-data "$webrootdocker"
	fi
fi

if [ "$phpini" != "default" ]; then
	if [ -f "$phpini" ]; then
		echo "Your custom php.ini at $phpini will be used."
		rm -f "$phppath"
		cp "$phpini" "$phppath"
	else
		echo "You have changed the php_ini variable, but the new file could not be found! Default php.ini file will be used instead."
	fi
fi

# Create nginx configuration directory
mkdir -p /etc/nginx/conf.d /etc/nginx/sites-enabled

# Generate default HTTP configuration
if [ "$ssl" = "true" ] && [ "$default_conf" = "default" ]; then
	echo "You have activated SSL. SSL Settings will be applied"
	if [ ! -f "/ssl/$certfile" ]; then
		echo "Cannot find certificate file $certfile"
		exit 1
	fi
	if [ ! -f "/ssl/$keyfile" ]; then
		echo "Cannot find certificate key file $keyfile"
		exit 1
	fi

	# HTTP server block with redirect to HTTPS
	cat >/etc/nginx/sites-enabled/default.conf <<EOF
server {
    listen 80;
    server_name ${website_name};

    # Redirect all HTTP to HTTPS
    return 301 https://\$host\$request_uri;
}
EOF

	# HTTPS server block
	cat >/etc/nginx/sites-enabled/default-ssl.conf <<EOF
server {
    listen 443 ssl http2;
    server_name ${website_name};

    root ${webrootdocker};
    index index.html index.htm index.php;

    ssl_certificate /ssl/${certfile};
    ssl_certificate_key /ssl/${keyfile};

    # SSL configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # PHP-FPM configuration
    location ~ \.php$ {
        fastcgi_pass 127.0.0.1:9000;
        fastcgi_index index.php;
        fastcgi_param SCRIPT_FILENAME \$document_root\$fastcgi_script_name;
        include fastcgi_params;
    }

    # Static files
    location / {
        try_files \$uri \$uri/ =404;
    }

    # Logging
    access_log /dev/stdout;
    error_log /dev/stderr;
}
EOF
else
	echo "SSL is deactivated and/or you are using a custom config."
	# HTTP only configuration
	cat >/etc/nginx/sites-enabled/default.conf <<EOF
server {
    listen 80;
    server_name ${website_name};

    root ${webrootdocker};
    index index.html index.htm index.php;

    # PHP-FPM configuration
    location ~ \.php$ {
        fastcgi_pass 127.0.0.1:9000;
        fastcgi_index index.php;
        fastcgi_param SCRIPT_FILENAME \$document_root\$fastcgi_script_name;
        include fastcgi_params;
    }

    # Static files
    location / {
        try_files \$uri \$uri/ =404;
    }

    # Logging
    access_log /dev/stdout;
    error_log /dev/stderr;
}
EOF
fi

# Include sites-enabled in main nginx.conf
if ! grep -q "include /etc/nginx/sites-enabled" /etc/nginx/nginx.conf; then
	# Add include directive in http block
	# Check for active include directives (ignore comments by requiring start of line anchor with optional space)
	if grep -E -q "^[[:space:]]*include[[:space:]]+/etc/nginx/http\.d/\*\.conf;" /etc/nginx/nginx.conf; then
		sed -i -E '/^[[:space:]]*include[[:space:]]+\/etc\/nginx\/http\.d\/\*\.conf;/a\    include /etc/nginx/sites-enabled/*.conf;' /etc/nginx/nginx.conf
	elif grep -E -q "^[[:space:]]*include[[:space:]]+/etc/nginx/conf\.d/\*\.conf;" /etc/nginx/nginx.conf; then
		sed -i -E '/^[[:space:]]*include[[:space:]]+\/etc\/nginx\/conf\.d\/\*\.conf;/a\    include /etc/nginx/sites-enabled/*.conf;' /etc/nginx/nginx.conf
	else
		# Fallback: find http block, handling potential whitespace
		sed -i -E '/^http[[:space:]]*\{/a\    include /etc/nginx/sites-enabled/*.conf;' /etc/nginx/nginx.conf
	fi
fi

if [ "$default_conf" = "get_config" ]; then
	if [ -f /etc/nginx/sites-enabled/default.conf ]; then
		mkdir -p /etc/nginx/sites-enabled
		cp /etc/nginx/sites-enabled/default.conf /share/nginx-default.conf
		echo "You have requested a copy of the nginx config. You can now find it at /share/nginx-default.conf ."
	fi
	if [ -f /etc/nginx/nginx.conf ]; then
		cp /etc/nginx/nginx.conf /share/nginx.conf
		echo "You have requested a copy of the nginx config. You can now find it at /share/nginx.conf ."
	fi
	if [ "$default_ssl_conf" != "get_config" ]; then
		echo "Exiting now..."
		exit 0
	fi
fi

if [[ ! $default_conf =~ ^(default|get_config)$ ]]; then
	if [ -f "$default_conf" ]; then
		if [ ! -d /etc/nginx/sites-enabled ]; then
			mkdir -p /etc/nginx/sites-enabled
		fi
		if [ -f /etc/nginx/sites-enabled/default.conf ]; then
			rm -f /etc/nginx/sites-enabled/default.conf
		fi
		cp -rf "$default_conf" /etc/nginx/sites-enabled/default.conf
		echo "Your custom nginx config at $default_conf will be used."
	else
		echo "Can't find your custom default.conf file $default_conf - be sure you have chosen the full path. Exiting now..."
		exit 1
	fi
fi

if [ "$default_ssl_conf" = "get_config" ]; then
	if [ -f /etc/nginx/sites-enabled/default-ssl.conf ]; then
		cp /etc/nginx/sites-enabled/default-ssl.conf /share/nginx-default-ssl.conf
		echo "You have requested a copy of the nginx ssl config. You can now find it at /share/nginx-default-ssl.conf ."
	fi
	echo "Exiting now..."
	exit 0
fi

if [ "$default_ssl_conf" != "default" ]; then
	if [ -f "$default_ssl_conf" ]; then
		if [ ! -d /etc/nginx/sites-enabled ]; then
			mkdir -p /etc/nginx/sites-enabled
		fi
		if [ -f /etc/nginx/sites-enabled/default-ssl.conf ]; then
			rm -f /etc/nginx/sites-enabled/default-ssl.conf
		fi
		cp -rf "$default_ssl_conf" /etc/nginx/sites-enabled/default-ssl.conf
		echo "Your custom nginx config at $default_ssl_conf will be used."
	else
		echo "Can't find your custom default-ssl.conf file $default_ssl_conf - be sure you have chosen the full path. Exiting now..."
		exit 1
	fi
fi

mkdir -p /usr/lib/php84/modules/opcache

# Configure PHP-FPM
mkdir -p /etc/php84/php-fpm.d

# Ensure PHP-FPM listens on TCP socket (needed for nginx)
if [ ! -f /etc/php84/php-fpm.d/www.conf ]; then
	# Create minimal www.conf if it doesn't exist
	cat >/etc/php84/php-fpm.d/www.conf <<'PHPFPM_EOF'
[www]
listen = 127.0.0.1:9000
PHPFPM_EOF
else
	# File exists - check if listen directive is present
	if grep -q "^listen\s*=" /etc/php84/php-fpm.d/www.conf; then
		# Replace existing listen directive
		sed -i 's/^listen\s*=.*/listen = 127.0.0.1:9000/' /etc/php84/php-fpm.d/www.conf
	else
		# Append listen directive if not present
		echo "listen = 127.0.0.1:9000" >>/etc/php84/php-fpm.d/www.conf
	fi
fi

# Ensure fastcgi_params exists (should be in nginx package, but verify)
if [ ! -f /etc/nginx/fastcgi_params ]; then
	cat >/etc/nginx/fastcgi_params <<'FASTCGI_EOF'
fastcgi_param  QUERY_STRING       $query_string;
fastcgi_param  REQUEST_METHOD    $request_method;
fastcgi_param  CONTENT_TYPE      $content_type;
fastcgi_param  CONTENT_LENGTH    $content_length;

fastcgi_param  SCRIPT_NAME       $fastcgi_script_name;
fastcgi_param  REQUEST_URI       $request_uri;
fastcgi_param  DOCUMENT_URI      $document_uri;
fastcgi_param  DOCUMENT_ROOT    $document_root;
fastcgi_param  SERVER_PROTOCOL  $server_protocol;
fastcgi_param  REQUEST_SCHEME   $scheme;
fastcgi_param  HTTPS            $https if_not_empty;

fastcgi_param  GATEWAY_INTERFACE  CGI/1.1;
fastcgi_param  SERVER_SOFTWARE    nginx/$nginx_version;

fastcgi_param  REMOTE_ADDR        $remote_addr;
fastcgi_param  REMOTE_PORT        $remote_port;
fastcgi_param  SERVER_ADDR        $server_addr;
fastcgi_param  SERVER_PORT        $server_port;
fastcgi_param  SERVER_NAME        $server_name;

# PHP only, required if PHP was built with --enable-force-cgi-redirect
fastcgi_param  REDIRECT_STATUS    200;
FASTCGI_EOF
fi

echo "Here is your web file architecture."
ls -l "$webrootdocker"

# Verify Nginx configuration
if ! nginx -t; then
    echo "❌ Nginx configuration Check Failed!"
    echo "Dump of /etc/nginx/nginx.conf:"
    cat /etc/nginx/nginx.conf
    if [ -f /etc/nginx/sites-enabled/default.conf ]; then
        echo "Dump of /etc/nginx/sites-enabled/default.conf:"
        cat /etc/nginx/sites-enabled/default.conf
    fi
    exit 1
fi
