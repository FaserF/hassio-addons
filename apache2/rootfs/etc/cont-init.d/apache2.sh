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
log_level=$(bashio::config 'log_level')
webrootdocker=/var/www/localhost/htdocs/

# Map Bashio log_level to Apache log_level
# Bashio: trace, debug, info, notice, warning, error, fatal
# Apache: debug, info, notice, warn, error, crit, alert, emerg
apache_log_level="warn"
case "${log_level}" in
trace | debug) apache_log_level="debug" ;;
info) apache_log_level="info" ;;
notice) apache_log_level="notice" ;;
warning | warn) apache_log_level="warn" ;;
error) apache_log_level="error" ;;
fatal) apache_log_level="crit" ;;
*) apache_log_level="warn" ;;
esac

echo "Setting Apache log level to: ${apache_log_level}"
if grep -i -q "^LogLevel " /etc/apache2/httpd.conf 2>/dev/null; then
	sed -i -E "s/^LogLevel .*/LogLevel ${apache_log_level}/I" /etc/apache2/httpd.conf
else
	echo "LogLevel ${apache_log_level}" >>/etc/apache2/httpd.conf
fi
phppath=/etc/php85/php.ini

if [ "$phpini" = "get_file" ]; then
	cp "$phppath" /share/apache2addon_php.ini
	echo "You have requestet a copy of the php.ini file. You will now find your copy at /share/apache2addon_php.ini"
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
# Reference: https://github.com/FaserF/hassio-addons/tree/master/apache2#security
# ------------------------------------------------------------------------------
if bashio::config.has_value 'init_commands'; then
	echo "Detected custom init commands. Running them now."
	while read -r cmd; do
		eval "${cmd}" ||
			bashio::exit.nok "Failed executing init command: ${cmd}"
	done <<<"$(bashio::config 'init_commands')"
fi

rm -r "$webrootdocker"

if [ ! -d "$DocumentRoot" ]; then
	echo "You haven't put your website to $DocumentRoot"
	echo "A default website will now be used"
	mkdir "$webrootdocker"
	cp /index.html "$webrootdocker"
else
	#Create Shortcut to shared html folder
	ln -s "$DocumentRoot" /var/www/localhost/htdocs
fi

#Set rights to web folders and create user
if [ -d "$DocumentRoot" ]; then
	find "$DocumentRoot" -type d -exec chmod 771 {} \;
	if [ -n "$username" ] && [ -n "$password" ] && [ ! "$username" = "null" ] && [ ! "$password" = "null" ]; then
		if ! id "$username" &>/dev/null; then
			adduser -S "$username" -G www-data
		fi
		echo "$username:$password" | chpasswd
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
		rm "$phppath"
		cp "$phpini" "$phppath"
	else
		echo "You have changed the php_ini variable, but the new file could not be found! Default php.ini file will be used instead."
	fi
fi

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
	mkdir /etc/apache2/sites-enabled
	sed -i '/LoadModule rewrite_module/s/^#//g' /etc/apache2/httpd.conf
	echo "Listen 8099" >>/etc/apache2/httpd.conf
	echo "<VirtualHost *:80>" >/etc/apache2/sites-enabled/000-default.conf
	echo "ServerName $website_name" >>/etc/apache2/sites-enabled/000-default.conf
	echo "ServerAdmin webmaster@localhost" >>/etc/apache2/sites-enabled/000-default.conf
	echo "DocumentRoot $webrootdocker" >>/etc/apache2/sites-enabled/000-default.conf

	echo "#Redirect http to https" >>/etc/apache2/sites-enabled/000-default.conf
	echo "    RewriteEngine On" >>/etc/apache2/sites-enabled/000-default.conf
	echo "    RewriteCond %{HTTPS} off" >>/etc/apache2/sites-enabled/000-default.conf
	echo "    RewriteRule (.*) https://%{HTTP_HOST}%{REQUEST_URI}" >>/etc/apache2/sites-enabled/000-default.conf
	echo "#End Redirect http to https" >>/etc/apache2/sites-enabled/000-default.conf

	echo "    ErrorLog /var/log/error.log" >>/etc/apache2/sites-enabled/000-default.conf
	echo "        #CustomLog /var/log/access.log combined" >>/etc/apache2/sites-enabled/000-default.conf
	echo "</VirtualHost>" >>/etc/apache2/sites-enabled/000-default.conf

	echo "<IfModule mod_ssl.c>" >/etc/apache2/sites-enabled/000-default-le-ssl.conf
	echo "<VirtualHost *:443>" >>/etc/apache2/sites-enabled/000-default-le-ssl.conf
	echo "ServerName $website_name" >>/etc/apache2/sites-enabled/000-default-le-ssl.conf
	echo "ServerAdmin webmaster@localhost" >>/etc/apache2/sites-enabled/000-default-le-ssl.conf
	echo "DocumentRoot $webrootdocker" >>/etc/apache2/sites-enabled/000-default-le-ssl.conf

	echo "    ErrorLog /var/log/error.log" >>/etc/apache2/sites-enabled/000-default-le-ssl.conf
	echo "        #CustomLog /var/log/access.log combined" >>/etc/apache2/sites-enabled/000-default-le-ssl.conf
	echo "SSLCertificateFile /ssl/$certfile" >>/etc/apache2/sites-enabled/000-default-le-ssl.conf
	echo "SSLCertificateKeyFile /ssl/$keyfile" >>/etc/apache2/sites-enabled/000-default-le-ssl.conf
	echo "</VirtualHost>" >>/etc/apache2/sites-enabled/000-default-le-ssl.conf
	echo "</IfModule>" >>/etc/apache2/sites-enabled/000-default-le-ssl.conf
else
	echo "SSL is deactivated and/or you are using a custom config."
fi
if [ "$ssl" = "true" ] || [ "$default_conf" != "default" ]; then
	echo "Include /etc/apache2/sites-enabled/*.conf" >>/etc/apache2/httpd.conf
fi

sed -i -e '/AllowOverride/s/None/All/' /etc/apache2/httpd.conf

if [ "$default_conf" = "get_config" ]; then
	if [ -f /etc/apache2/sites-enabled/000-default.conf ]; then
		if [ ! -d /etc/apache2/sites-enabled ]; then
			mkdir /etc/apache2/sites-enabled
		fi
		cp /etc/apache2/sites-enabled/000-default.conf /share/000-default.conf
		echo "You have requested a copy of the apache2 config. You can now find it at /share/000-default.conf ."
	fi
	if [ -f /etc/apache2/httpd.conf ]; then
		cp /etc/apache2/httpd.conf /share/httpd.conf
		echo "You have requested a copy of the apache2 config. You can now find it at /share/httpd.conf ."
	fi
	if [ "$default_ssl_conf" != "get_config" ]; then
		echo "Exiting now..."
		exit 0
	fi
fi

if [[ ! $default_conf =~ ^(default|get_config)$ ]]; then
	if [ -f "$default_conf" ]; then
		if [ ! -d /etc/apache2/sites-enabled ]; then
			mkdir /etc/apache2/sites-enabled
		fi
		if [ -f /etc/apache2/sites-enabled/000-default.conf ]; then
			rm /etc/apache2/sites-enabled/000-default.conf
		fi
		cp -rf "$default_conf" /etc/apache2/sites-enabled/000-default.conf
		echo "Your custom apache config at $default_conf will be used."
	else
		echo "Cant find your custom 000-default.conf file $default_conf - be sure you have chosen the full path. Exiting now..."
		exit 1
	fi
fi

if [ "$default_ssl_conf" = "get_config" ]; then
	if [ -f /etc/apache2/sites-enabled/000-default-le-ssl.conf ]; then
		cp /etc/apache2/sites-enabled/000-default-le-ssl.conf /share/000-default-le-ssl.conf
		echo "You have requested a copy of the apache2 ssl config. You can now find it at /share/000-default-le-ssl.conf ."
	fi
	echo "Exiting now..."
	exit 0
fi

if [ "$default_ssl_conf" != "default" ]; then
	if [ -f "$default_ssl_conf" ]; then
		if [ ! -d /etc/apache2/sites-enabled ]; then
			mkdir /etc/apache2/sites-enabled
		fi
		if [ -f /etc/apache2/sites-enabled/000-default-le-ssl.conf ]; then
			rm /etc/apache2/sites-enabled/000-default-le-ssl.conf
		fi
		cp -rf "$default_ssl_conf" /etc/apache2/sites-enabled/000-default-le-ssl.conf
		echo "Your custom apache config at $default_ssl_conf will be used."
	else
		echo "Cant find your custom 000-default-le-ssl.conf file $default_ssl_conf - be sure you have chosen the full path. Exiting now..."
		exit 1
	fi
fi

mkdir /usr/lib/php84/modules/opcache

echo "Here is your web file architecture."
ls -l "$webrootdocker"
