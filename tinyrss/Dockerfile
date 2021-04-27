ARG BUILD_FROM=ghcr.io/hassio-addons/debian-base/amd64:4.2.0
FROM ${BUILD_FROM}

# Set shell
SHELL ["/bin/bash", "-o", "pipefail", "-c"]

# hadolint ignore=DL3009
RUN \
    apt-get update -y \
    \
    && apt-get install -y --no-install-recommends \
    nginx supervisor curl php-fpm php-cli php-curl php-gd php-json php-mysql mariadb-client \
    php-dev libmcrypt-dev php-pear \
    php-pgsql php-mysql && apt-get clean && rm -rf /var/lib/apt/lists/*

# enable the mcrypt module
#RUN phpenmod libmcrypt

# add ttrss as the only nginx site
#ADD ttrss.nginx.conf /etc/nginx/sites-available/ttrss
RUN ln -s /etc/nginx/sites-available/ttrss /etc/nginx/sites-enabled/ttrss
RUN rm /etc/nginx/sites-enabled/default

# install ttrss and patch configuration
WORKDIR /var/www
RUN apt-get update && DEBIAN_FRONTEND=noninteractive apt-get install -y curl --no-install-recommends && rm -rf /var/lib/apt/lists/* \
    && curl -SL https://git.tt-rss.org/fox/tt-rss/archive/master.tar.gz | tar xzC /var/www --strip-components 1 \
    && chown www-data:www-data -R /var/www \
    && chmod 775 -R /var/www
#RUN cp config.php-dist config.php

# Copy data for add-on
COPY run.sh /
RUN chmod a+x /run.sh
CMD [ "/run.sh" ]