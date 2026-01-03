ARG BUILD_FROM=ghcr.io/hassio-addons/base:19.0.0
# hadolint ignore=DL3006
FROM ${BUILD_FROM} as base


# Install system requirements
# Pterodactyl Panel v1.11+ requires PHP 8.2/8.3
# hadolint ignore=DL3018

# Addon metadata (injected by CI)
ENV ADDON_VERSION="0.10.0"
ENV ADDON_NAME="pterodactyl Panel Gameserver - BETA"
ENV ADDON_SLUG="pterodactyl_panel"
ENV ADDON_UNSUPPORTED="false"

RUN apk add --no-cache \
    redis \
    curl \
    gettext \
    mariadb-client \
    nginx \
    php83 \
    php83-bcmath \
    php83-common \
    php83-dom \
    php83-fileinfo \
    php83-fpm \
    php83-gd \
    php83-pecl-memcached \
    php83-mbstring \
    php83-openssl \
    php83-posix \
    php83-pdo \
    php83-phar \
    php83-sodium \
    php83-pdo_mysql \
    php83-session \
    php83-simplexml \
    php83-tokenizer \
    php83-ctype \
    php83-zip \
    php83-xmlwriter \
    tini \
    && mkdir -p /var/www/html /run/nginx /etc/nginx/conf.d/ \
    && ln -sf /usr/bin/php83 /usr/bin/php

# Build phase of the container
# This is where composer is added and pterodactyl properly setup
FROM base as build

WORKDIR /var/www/html
# Install build-only dependencies (not needed in production)
# hadolint ignore=DL3018
RUN apk add --no-cache \
    yarn \
    git \
    && git clone https://github.com/pterodactyl/panel ./ --depth 1 --branch release/v1.11.11 \
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
ARG BUILD_DATE="1970-01-01T00:00:00Z"
ENV PTERODACTYL_VERSION="v1.11.11"

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
