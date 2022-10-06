ARG BUILD_FROM=ghcr.io/hassio-addons/debian-base:6.1.2
# hadolint ignore=DL3006
FROM ${BUILD_FROM}

# Add "add-apt-repository" command
RUN apt -y install software-properties-common curl apt-transport-https ca-certificates gnupg

# Add additional repositories for PHP, Redis, and MariaDB
RUN LC_ALL=C.UTF-8 add-apt-repository -y ppa:ondrej/php
RUN add-apt-repository ppa:redislabs/redis -y

RUN curl -sS https://downloads.mariadb.com/MariaDB/mariadb_repo_setup | sudo bash

# Update repositories list
RUN apt update

# Add universe repository if you are on Ubuntu 18.04
RUN apt-add-repository universe

# Install Dependencies
RUN apt -y install php8.1 php8.1-{common,cli,gd,mysql,mbstring,bcmath,xml,fpm,curl,zip} mariadb-server nginx tar unzip git redis-server

RUN curl -sS https://getcomposer.org/installer | sudo php -- --install-dir=/usr/local/bin --filename=composer

#Install pterodactyl stuff
mkdir -p /var/www/pterodactyl
cd /var/www/pterodactyl

curl -Lo panel.tar.gz https://github.com/pterodactyl/panel/releases/latest/download/panel.tar.gz
tar -xzvf panel.tar.gz
chmod -R 755 storage/* bootstrap/cache/
chown -R www-data:www-data /var/www/pterodactyl/*

cp .env.example .env
composer install --no-dev --optimize-autoloader

# Only run the command below if you are installing this Panel for
# the first time and do not have any Pterodactyl Panel data in the database.
php artisan key:generate --force


RUN chmod a+x /run.sh
RUN chmod a+x /index.html
CMD [ "/run.sh" ]
