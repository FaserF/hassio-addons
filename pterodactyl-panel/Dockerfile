#############
ARG BUILD_FROM=ghcr.io/hassio-addons/base:12.2.6
# hadolint ignore=DL3006
FROM ${BUILD_FROM} as base

RUN \
    apk --update add curl gettext mariadb-client nginx php81 php81 php81-bcmath php81-common php81-dom php81-fileinfo \
    php81-fpm php81-gd php81-pecl-memcached php81-mbstring php81-openssl php81-pdo php81-phar php81-json php81-sodium \
    php81-pdo_mysql php81-session php81-simplexml php81-tokenizer php81-ctype php81-zlib php81-zip php81-xmlwriter \
    tini \
    && mkdir -p /var/www/html /run/nginx /etc/nginx/conf.d/ \
    && ln -s /usr/bin/php81 /usr/bin/php

# Build phase of the container
# This is where composer is added and pterodactyl properly setup
FROM base as build

WORKDIR /var/www/html

RUN \
    apk add yarn git;

RUN \
    git clone https://github.com/pterodactyl/panel ./ --depth 1 --branch release/v1.10.4; \
    rm .git -rf; \
    chmod -R 755 storage/* bootstrap/cache; \
    find storage -type d > .storage.tmpl; \
    curl -sS https://getcomposer.org/installer | php -- --install-dir=/usr/local/bin --filename=composer; \
    cp .env.example .env; \
    composer install --ansi --no-dev --optimize-autoloader; \
    chown -R nginx:nginx *;

RUN \
    yarn install --production; \
    yarn add cross-env; \
    yarn run build:production; \
    rm -rf node_modules;

# Final Production phase of the controller
# All build requirements get scrapped as to maintain a small image
FROM base as production

WORKDIR /var/www/html

COPY --from=build --chown=nginx:nginx /var/www /var/www
COPY ./root/ /

# Copy data for add-on
COPY run.sh /
RUN chmod a+x /run.sh
RUN chmod 775 /var/www/html/*
CMD [ "/run.sh" ]