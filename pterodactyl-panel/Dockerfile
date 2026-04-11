ARG BUILD_FROM=ghcr.io/hassio-addons/base:20.0.3
# hadolint ignore=DL3006
FROM ${BUILD_FROM} as base

ENV PTERODACTYL_VERSION="v1.12.0"

# Install system requirements
# Pterodactyl Panel v1.11+ requires PHP 8.2/8.3
# hadolint ignore=DL3018

# App metadata (injected by CI)
ENV APP_VERSION="1.2.1"
ENV APP_NAME="pterodactyl Panel Gameserver"
ENV APP_SLUG="pterodactyl_panel"
ENV APP_UNSUPPORTED="false"

RUN \
    echo "http://dl-cdn.alpinelinux.org/alpine/v3.23/main" > /etc/apk/repositories \
    && echo "http://dl-cdn.alpinelinux.org/alpine/v3.23/community" >> /etc/apk/repositories \
    && apk upgrade --no-cache --available \
    && apk add --no-cache \
    redis \
    curl \
    gettext \
    mariadb-client \
    nginx \
    php85 \
    php85-bcmath \
    php85-common \
    php85-dom \
    php85-fileinfo \
    php85-fpm \
    php85-gd \
    php85-pecl-memcached \
    php85-mbstring \
    php85-openssl \
    php85-posix \
    php85-pdo \
    php85-phar \
    php85-sodium \
    php85-pdo_mysql \
    php85-session \
    php85-simplexml \
    php85-tokenizer \
    php85-ctype \
    php85-zip \
    php85-xmlwriter \
    php85-iconv \
    tini \
    su-exec \
    openssl \
    && mkdir -p /var/www/html /run/nginx /etc/nginx/conf.d/ \
    && ln -sf /usr/bin/php85 /usr/bin/php

# Build phase of the container
# This is where composer is added and pterodactyl properly setup
FROM base as build

WORKDIR /var/www/html
# Install build-only dependencies (not needed in production)
# hadolint ignore=DL3018
    # Safe Composer installation \
RUN \
    echo "http://dl-cdn.alpinelinux.org/alpine/v3.23/main" > /etc/apk/repositories \
    && echo "http://dl-cdn.alpinelinux.org/alpine/v3.23/community" >> /etc/apk/repositories \
    && apk upgrade --no-cache --available \
    && apk add --no-cache \
    yarn \
    git \
    && git clone https://github.com/pterodactyl/panel ./ --depth 1 --branch "release/${PTERODACTYL_VERSION}" \
    && rm -rf .git \
    && chmod -R 755 storage/* bootstrap/cache \
    && find storage -type d > .storage.tmpl \
    && curl -fsSL https://getcomposer.org/installer -o /tmp/composer-setup.php \
    && php /tmp/composer-setup.php --install-dir=/usr/local/bin --filename=composer \
    && rm /tmp/composer-setup.php \
    && cp .env.example .env \
    && composer install --ansi --no-dev --optimize-autoloader \
    && rm -rf .git \
    && chown -R nginx:nginx . \
    && yarn install --production \
    && yarn add cross-env \
    && export NODE_OPTIONS \
    && yarn run build:production \
    && rm -rf node_modules

# Final Production phase of the controller
# All build requirements get scrapped as to maintain a small image
FROM base as production
ARG BUILD_DATE="1970-01-01T00:00:00Z"

WORKDIR /var/www/html

COPY --from=build --chown=nginx:nginx /var/www/html /var/www/html
COPY ./rootfs/ /

# Copy data for add-on
COPY run.sh /
RUN chmod a+x /run.sh \
    && chmod -R 775 /var/www/html/storage /var/www/html/bootstrap/cache
CMD [ "/run.sh" ]

# Health check
HEALTHCHECK --interval=30s --timeout=10s --retries=5 --start-period=120s \
  CMD curl --fail http://127.0.0.1:80 || exit 1

# Labels
LABEL org.opencontainers.image.title="pterodactyl Panel Gameserver"
LABEL org.opencontainers.image.description="Open-Source Gameserver Management Panel"
LABEL org.opencontainers.image.vendor="FaserF's Home Assistant Apps"
LABEL org.opencontainers.image.authors="FaserF <https://github.com/FaserF>"
LABEL org.opencontainers.image.licenses="MIT"
LABEL org.opencontainers.image.url="https://github.com/FaserF/hassio-addons/tree/master/pterodactyl-panel"
LABEL org.opencontainers.image.source="https://github.com/FaserF/hassio-addons/tree/master/pterodactyl-panel"
LABEL org.opencontainers.image.documentation="https://github.com/FaserF/hassio-addons/blob/master/pterodactyl-panel/README.md"
LABEL org.opencontainers.image.created="${BUILD_DATE}"
