ARG BUILD_FROM
ARG BUILD_DATE
# hadolint ignore=DL3006
FROM ${BUILD_FROM} as base
ARG BUILD_DATE

# Install system requirements
# IMPORTANT: Pterodactyl Panel v1.10.4 requires PHP 8.1 - DO NOT UPGRADE
# renovate: ignore
RUN apk add --no-cache \
    redis \
    curl \
    gettext \
    mariadb-client \
    nginx \
    php81 \
    php81-bcmath \
    php81-common \
    php81-dom \
    php81-fileinfo \
    php81-fpm \
    php81-gd \
    php81-pecl-memcached \
    php81-mbstring \
    php81-openssl \
    php81-pdo \
    php81-phar \
    php81-sodium \
    php81-pdo_mysql \
    php81-session \
    php81-simplexml \
    php81-tokenizer \
    php81-ctype \
    php81-zip \
    php81-xmlwriter \
    tini \
    yarn \
    git \
    && mkdir -p /var/www/html /run/nginx /etc/nginx/conf.d/ \
    && ln -s /usr/bin/php81 /usr/bin/php

# Build phase of the container
# This is where composer is added and pterodactyl properly setup
FROM base as build
ARG BUILD_DATE
WORKDIR /var/www/html
RUN git clone https://github.com/pterodactyl/panel ./ --depth 1 --branch release/v1.10.4 \
    && rm -rf .git \
    && chmod -R 755 storage/* bootstrap/cache \
    && find storage -type d > .storage.tmpl \
    # Safe Composer installation \
    && curl -fsSL https://getcomposer.org/installer -o /tmp/composer-setup.php \
    && php /tmp/composer-setup.php --install-dir=/usr/local/bin --filename=composer \
    && rm /tmp/composer-setup.php \
    && cp .env.example .env \
    && composer install --ansi --no-dev --optimize-autoloader \
    && chown -R nginx:nginx . \
    && yarn install --production \
    && yarn add cross-env \
    && yarn run build:production \
    && rm -rf node_modules

# Final Production phase of the controller
# All build requirements get scrapped as to maintain a small image
FROM base as production
ARG BUILD_DATE

WORKDIR /var/www/html

COPY --from=build --chown=nginx:nginx /var/www/html /var/www/html
COPY ./root/ /

# Copy data for add-on
COPY run.sh /
RUN chmod a+x /run.sh \
    && chmod -R 775 /var/www/html/storage /var/www/html/bootstrap/cache
CMD [ "/run.sh" ]


# Health check
HEALTHCHECK CMD curl --fail http://127.0.0.1:80 || exit 1

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
