ARG BUILD_FROM
ARG BUILD_DATE
# hadolint ignore=DL3006
FROM ${BUILD_FROM} as base
ARG BUILD_DATE

# Install system requirements and PHP 8.4 (pinned for Alpine 3.21/Base 19.0.0)
RUN apk add --no-cache \
    redis=7.2.7-r0 \
    curl=8.11.1-r0 \
    gettext=0.22.5-r0 \
    mariadb-client=11.4.4-r1 \
    nginx=1.26.2-r4 \
    php84=8.4.1-r0 \
    php84-bcmath=8.4.1-r0 \
    php84-common=8.4.1-r0 \
    php84-dom=8.4.1-r0 \
    php84-fileinfo=8.4.1-r0 \
    php84-fpm=8.4.1-r0 \
    php84-gd=8.4.1-r0 \
    php84-pecl-memcached=3.2.0-r4 \
    php84-mbstring=8.4.1-r0 \
    php84-openssl=8.4.1-r0 \
    php84-pdo=8.4.1-r0 \
    php84-phar=8.4.1-r0 \
    php84-sodium=8.4.1-r0 \
    php84-pdo_mysql=8.4.1-r0 \
    php84-session=8.4.1-r0 \
    php84-simplexml=8.4.1-r0 \
    php84-tokenizer=8.4.1-r0 \
    php84-ctype=8.4.1-r0 \
    php84-zip=8.4.1-r0 \
    php84-xmlwriter=8.4.1-r0 \
    tini=0.19.0-r3 \
    yarn=1.22.22-r1 \
    git=2.47.1-r0
RUN mkdir -p /var/www/html /run/nginx /etc/nginx/conf.d/
RUN ln -s /usr/bin/php84 /usr/bin/php

# Build phase of the container
# This is where composer is added and pterodactyl properly setup
FROM base as build
ARG BUILD_DATE
WORKDIR /var/www/html
RUN git clone https://github.com/pterodactyl/panel ./ --depth 1 --branch release/v1.10.4
RUN rm -rf .git
RUN chmod -R 755 storage/* bootstrap/cache
RUN find storage -type d > .storage.tmpl
# Safe Composer installation
RUN curl -fsSL https://getcomposer.org/installer -o /tmp/composer-setup.php && \
    php /tmp/composer-setup.php --install-dir=/usr/local/bin --filename=composer && \
    rm /tmp/composer-setup.php
RUN cp .env.example .env
RUN composer install --ansi --no-dev --optimize-autoloader
RUN chown -R nginx:nginx *
RUN yarn install --production
RUN yarn add cross-env
RUN yarn run build:production
RUN rm -rf node_modules

# Final Production phase of the controller
# All build requirements get scrapped as to maintain a small image
FROM base as production
ARG BUILD_DATE

WORKDIR /var/www/html

COPY --from=build --chown=nginx:nginx /var/www/html /var/www/html
COPY ./root/ /

# Copy data for add-on
COPY run.sh /
RUN chmod a+x /run.sh
RUN chmod 775 /var/www/html/*
CMD [ "/run.sh" ]

# Labels
LABEL org.opencontainers.image.title="pterodactyl Panel Gameserver - BETA"
LABEL org.opencontainers.image.description="Open-Source Gameserver - Currently not fully working"
LABEL org.opencontainers.image.vendor="FaserF's Home Assistant Add-ons"
LABEL org.opencontainers.image.authors="FaserF <https://github.com/FaserF>"
LABEL org.opencontainers.image.licenses="MIT"
LABEL org.opencontainers.image.url="https://github.com/FaserF/hassio-addons/tree/master/pterodactyl-panel"
LABEL org.opencontainers.image.source="https://github.com/FaserF/hassio-addons/tree/master/pterodactyl-panel"
LABEL org.opencontainers.image.documentation="https://github.com/FaserF/hassio-addons/blob/master/pterodactyl-panel/README.md"
LABEL org.opencontainers.image.created="${BUILD_DATE}"




