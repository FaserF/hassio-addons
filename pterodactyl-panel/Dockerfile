ARG BUILD_FROM=ghcr.io/hassio-addons/base:19.0.0
# hadolint ignore=DL3006
FROM ${BUILD_FROM} as base


# Install system requirements
# IMPORTANT: Pterodactyl Panel v1.10.4 requires PHP 8.1 - DO NOT UPGRADE
# Added Alpine 3.19 repositories to maintain PHP 8.1 compatibility
# NOTE: We mix Alpine 3.22 (base) and 3.19 (php81) repositories.
# To prevent conflicts, we explicitly pin ALL package versions.
RUN apk add --no-cache \
    --repository=https://dl-cdn.alpinelinux.org/alpine/v3.19/main \
    --repository=https://dl-cdn.alpinelinux.org/alpine/v3.19/community \
    --repository=https://dl-cdn.alpinelinux.org/alpine/v3.22/main \
    --repository=https://dl-cdn.alpinelinux.org/alpine/v3.22/community \
    redis=8.0.4-r0 \
    curl=8.14.1-r2 \
    gettext=0.24.1-r0 \
    mariadb-client=11.4.8-r0 \
    nginx=1.28.0-r3 \
    php81=8.1.32-r0 \
    php81-bcmath=8.1.32-r0 \
    php81-common=8.1.32-r0 \
    php81-dom=8.1.32-r0 \
    php81-fileinfo=8.1.32-r0 \
    php81-fpm=8.1.32-r0 \
    php81-gd=8.1.32-r0 \
    php81-pecl-memcached=3.2.0-r3 \
    php81-mbstring=8.1.32-r0 \
    php81-openssl=8.1.32-r0 \
    php81-pdo=8.1.32-r0 \
    php81-phar=8.1.32-r0 \
    php81-sodium=8.1.32-r0 \
    php81-pdo_mysql=8.1.32-r0 \
    php81-session=8.1.32-r0 \
    php81-simplexml=8.1.32-r0 \
    php81-tokenizer=8.1.32-r0 \
    php81-ctype=8.1.32-r0 \
    php81-zip=8.1.32-r0 \
    php81-xmlwriter=8.1.32-r0 \
    tini=0.19.0-r3 \
    && mkdir -p /var/www/html /run/nginx /etc/nginx/conf.d/ \
    && ln -s /usr/bin/php81 /usr/bin/php

# Build phase of the container
# This is where composer is added and pterodactyl properly setup
FROM base as build

WORKDIR /var/www/html
# Install build-only dependencies (not needed in production)
RUN apk add --no-cache \
    yarn=1.22.22-r1 \
    git=2.49.1-r0 \
    && git clone https://github.com/pterodactyl/panel ./ --depth 1 --branch release/v1.10.4 \
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
    && export NODE_OPTIONS=--openssl-legacy-provider \
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
HEALTHCHECK --interval=30s --timeout=10s --retries=3 --start-period=60s \
  CMD curl --fail http://127.0.0.1:80 || exit 1

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
