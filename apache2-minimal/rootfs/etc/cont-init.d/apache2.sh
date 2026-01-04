#!/usr/bin/with-contenv bashio
# shellcheck disable=SC2034,SC2129,SC2016
# shellcheck shell=bash

# Enable strict mode
set -euo pipefail
# shellcheck disable=SC1091



ssl=$(bashio::config 'ssl')
website_name=$(bashio::config 'website_name')
if [ -z "$website_name" ] || [ "$website_name" = "null" ]; then
    website_name="web.local"
fi
certfile=$(bashio::config 'certfile')
keyfile=$(bashio::config 'keyfile')
document_root=$(bashio::config 'document_root')
username=$(bashio::config 'username')
password=$(bashio::config 'password')
default_conf=$(bashio::config 'default_conf')
default_ssl_conf=$(bashio::config 'default_ssl_conf')
webrootdocker=/var/www/localhost/htdocs/

# WARNING: The init_commands option uses \`eval\`.
# This executes arbitrary shell commands as the container user/root.
# Only use trusted input for this option.
# No further sandboxing is performed.
# For more information, see:
# https://github.com/FaserF/hassio-addons/tree/master/apache2-minimal
if bashio::config.has_value 'init_commands'; then
	echo "Detected custom init commands. Running them now."
	while read -r cmd; do
		eval "${cmd}" ||
			bashio::exit.nok "Failed executing init command: ${cmd}"
	done <<<"$(bashio::config 'init_commands')"
fi

rm -rf -- "$webrootdocker"

if [ ! -d "$document_root" ]; then
	echo "You haven't put your website to $document_root"
	echo "DEBUGGING: $certfile $website_name $ssl"
	echo "A default website will now be used"
	mkdir -p "$webrootdocker"
	cp /index.html "$webrootdocker"
else
	#Create Shortcut to shared html folder
	mkdir -p /var/www/localhost
	ln -s "$document_root" /var/www/localhost/htdocs
fi

#Set rights to web folders and create user
if [ -d "$document_root" ]; then
	find "$document_root" -type d -exec chmod 755 {} \;
	if [ -n "$username" ] && [ -n "$password" ] && [ "$username" != "null" ] && [ "$password" != "null" ]; then
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
	mkdir -p /etc/apache2/sites-enabled
	sed -i '/LoadModule rewrite_module/s/^#//g' /etc/apache2/httpd.conf
	echo "Listen 8099" >>/etc/apache2/httpd.conf

	cat >/etc/apache2/sites-enabled/000-default.conf <<EOF
<VirtualHost *:80>
ServerName $website_name
ServerAdmin webmaster@localhost
DocumentRoot $webrootdocker
#Redirect http to https
    RewriteEngine On
    RewriteCond %{HTTPS} off
    RewriteRule (.*) https://%{HTTP_HOST}%{REQUEST_URI}
#End Redirect http to https
    ErrorLog /var/log/error.log
        #CustomLog /var/log/access.log combined
</VirtualHost>
EOF

	cat >/etc/apache2/sites-enabled/000-default-le-ssl.conf <<EOF
<IfModule mod_ssl.c>
<VirtualHost *:443>
ServerName $website_name
ServerAdmin webmaster@localhost
DocumentRoot $webrootdocker
    ErrorLog /var/log/error.log
        #CustomLog /var/log/access.log combined
SSLCertificateFile /ssl/$certfile
SSLCertificateKeyFile /ssl/$keyfile
</VirtualHost>
</IfModule>
EOF

else
	echo "SSL is deactivated and/or you are using a custom config."
fi
if [ "$ssl" = "true" ] || [ "$default_conf" != "default" ]; then
	echo "Include /etc/apache2/sites-enabled/*.conf" >>/etc/apache2/httpd.conf
fi

sed -i -e '/AllowOverride/s/None/All/' /etc/apache2/httpd.conf

if [ "$default_conf" = "get_config" ]; then
	if [ -f /etc/apache2/sites-enabled/000-default.conf ]; then
		mkdir -p /etc/apache2/sites-enabled
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
		mkdir -p /etc/apache2/sites-enabled
		if [ -f /etc/apache2/sites-enabled/000-default.conf ]; then
			rm /etc/apache2/sites-enabled/000-default.conf
		fi
		cp -f "$default_conf" /etc/apache2/sites-enabled/000-default.conf
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
		mkdir -p /etc/apache2/sites-enabled
		if [ -f /etc/apache2/sites-enabled/000-default-le-ssl.conf ]; then
			rm /etc/apache2/sites-enabled/000-default-le-ssl.conf
		fi
		cp -f "$default_ssl_conf" /etc/apache2/sites-enabled/000-default-le-ssl.conf
		echo "Your custom apache config at $default_ssl_conf will be used."
	else
		echo "Cant find your custom 000-default-le-ssl.conf file $default_ssl_conf - be sure you have chosen the full path. Exiting now..."
		exit 1
	fi
fi

echo "Here is your web file architecture."
ls -l "$webrootdocker"
