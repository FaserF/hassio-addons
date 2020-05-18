#!/usr/bin/env bashio
ssl=$(bashio::config 'ssl')
website_name=$(bashio::config 'website_name')
certfile=$(bashio::config 'certfile')
keyfile=$(bashio::config 'keyfile')

if [ -d /var/www/localhost/htdocs/ ]; then
    rm -r /var/www/localhost/htdocs/
    #Create Shortcut to shared html folder
    ln -s /share/htdocs /var/www/localhost/
fi

if [ $ssl = "true" ]; then
    echo "You have activated SSL. SSL Settings will be applied"
    mkdir /etc/apache2/sites-enabled
    sed -i '/LoadModule rewrite_module/s/^#//g' /etc/apache2/httpd.conf
    echo "Listen 8099" >> /etc/apache2/httpd.conf
    echo "Include /etc/apache2/sites-enabled/*.conf" >> /etc/apache2/httpd.conf
    echo "<VirtualHost *:80>" > /etc/apache2/sites-enabled/000-default.conf
    echo "ServerName $website_name"  >> /etc/apache2/sites-enabled/000-default.conf
    echo "ServerAdmin webmaster@localhost"  >> /etc/apache2/sites-enabled/000-default.conf
    echo "DocumentRoot /var/www/localhost/htdocs/"  >> /etc/apache2/sites-enabled/000-default.conf

    echo "#Redirect http to https"  >> /etc/apache2/sites-enabled/000-default.conf
    echo "    RewriteEngine On"  >> /etc/apache2/sites-enabled/000-default.conf
    echo "    RewriteCond %{HTTPS} off"  >> /etc/apache2/sites-enabled/000-default.conf
    echo "    RewriteRule (.*) https://%{HTTP_HOST}%{REQUEST_URI}"  >> /etc/apache2/sites-enabled/000-default.conf
    echo "#End Redirect http to https"  >> /etc/apache2/sites-enabled/000-default.conf

    echo "    ErrorLog /var/log/error.log"  >> /etc/apache2/sites-enabled/000-default.conf
    echo "        #CustomLog /var/log/access.log combined"  >> /etc/apache2/sites-enabled/000-default.conf
    echo "</VirtualHost>"  >> /etc/apache2/sites-enabled/000-default.conf

    echo "<IfModule mod_ssl.c>"  > /etc/apache2/sites-enabled/000-default-le-ssl.conf
    echo "<VirtualHost *:443>"  >> /etc/apache2/sites-enabled/000-default-le-ssl.conf
    echo "ServerName $website_name"  >> /etc/apache2/sites-enabled/000-default-le-ssl.conf
    echo "ServerAdmin webmaster@localhost"  >> /etc/apache2/sites-enabled/000-default-le-ssl.conf
    echo "DocumentRoot /var/www/localhost/htdocs/"  >> /etc/apache2/sites-enabled/000-default-le-ssl.conf

    echo "    ErrorLog /var/log/error.log"  >> /etc/apache2/sites-enabled/000-default-le-ssl.conf
    echo "        #CustomLog /var/log/access.log combined"  >> /etc/apache2/sites-enabled/000-default-le-ssl.conf
    echo "SSLCertificateFile /ssl/$certfile"  >> /etc/apache2/sites-enabled/000-default-le-ssl.conf
    echo "SSLCertificateKeyFile /ssl/$keyfile"  >> /etc/apache2/sites-enabled/000-default-le-ssl.conf
    echo "</VirtualHost>"  >> /etc/apache2/sites-enabled/000-default-le-ssl.conf
    echo "</IfModule>"  >> /etc/apache2/sites-enabled/000-default-le-ssl.conf
else
    echo "SSL is deactivated"
fi

echo "Here is your web file architecture."
ls -l /var/www/localhost/htdocs/

echo "Starting Apache2 - This is the last message in the log. If no error occured your web server should work."
exec /usr/sbin/httpd -D FOREGROUND