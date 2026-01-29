ARG BUILD_FROM=ghcr.io/hassio-addons/base:20.0.1
# hadolint ignore=DL3006
FROM ${BUILD_FROM}
# Base image includes s6-overlay; services use /usr/bin/with-contenv
ARG BUILD_DATE="1970-01-01T00:00:00Z"

# renovate: datasource=repology depName=alpine_3_21/nginx versioning=loose
ARG NGINX_VERSION=""

# Set shell with pipefail for Alpine (busybox/ash)
SHELL ["/bin/ash", "-o", "pipefail", "-c"]

# Create directory for nginx to store PID file and install dependencies
# hadolint ignore=DL3018,DL3047

# Addon metadata (injected by CI)
ENV ADDON_VERSION="0.2.0"
ENV ADDON_NAME="NGINX"
ENV ADDON_SLUG="nginx"
ENV ADDON_UNSUPPORTED="false"

# renovate: datasource=github-releases depName=php/php-src
ARG PHP_VERSION="8.5"

WORKDIR /tmp
# hadolint ignore=DL3018,DL3003
RUN mkdir -p /run/nginx /var/log/nginx /var/lib/nginx \
  && apk --no-cache -u add libssl3 libcrypto3 \
    nginx${NGINX_VERSION:+=$NGINX_VERSION} \
    curl \
    jq \
    && PHP_V=$(echo "${PHP_VERSION}" | awk -F. '{print $1$2}') \
    && apk add --no-cache \
    --repository=http://dl-cdn.alpinelinux.org/alpine/edge/community \
    --repository=http://dl-cdn.alpinelinux.org/alpine/edge/main \
    --repository=http://dl-cdn.alpinelinux.org/alpine/edge/testing \
    "php${PHP_V}-fpm" \
    "php${PHP_V}" \
    "php${PHP_V}-mysqli" \
    "php${PHP_V}-gd" \
    zlib \
    "php${PHP_V}-curl" \
    "php${PHP_V}-phar" \
    "php${PHP_V}-mbstring" \
    "php${PHP_V}-zip" \
    "php${PHP_V}-pdo" \
    "php${PHP_V}-pdo_mysql" \
    "php${PHP_V}-iconv" \
    "php${PHP_V}-dom" \
    "php${PHP_V}-session" \
    "php${PHP_V}-intl" \
    "php${PHP_V}-soap" \
    "php${PHP_V}-fileinfo" \
    "php${PHP_V}-xml" \
    "php${PHP_V}-ctype" \
    "php${PHP_V}-pdo_sqlite" \
    "php${PHP_V}-tokenizer" \
    "php${PHP_V}-exif" \
    "php${PHP_V}-xmlwriter" \
    "php${PHP_V}-cgi" \
    "php${PHP_V}-simplexml" \
    "php${PHP_V}-sockets" \
    "php${PHP_V}-imap" \
    "php${PHP_V}-apcu" \
    mosquitto \
    mariadb-client \
    ffmpeg \
    cmake make musl-dev gcc gettext-dev libintl libxml2 git \
    && git clone --depth 1 --branch master https://gitlab.com/rilian-la-te/musl-locales.git musl-locales-master \
    && cd musl-locales-master \
    && cmake -DCMAKE_POLICY_VERSION_MINIMUM=3.5 -DLOCALE_PROFILE=OFF -DCMAKE_INSTALL_PREFIX:PATH=/usr . && make && make install \
    && cd .. && rm -rf musl-locales-master \
    && apk del --no-cache cmake make musl-dev gcc gettext-dev libintl

# Configure Logging
# shellcheck disable=SC2015
RUN sed -i 's|access_log /var/log/nginx/access.log;|access_log /dev/stdout;|g' /etc/nginx/nginx.conf \
 && sed -i 's|error_log /var/log/nginx/error.log;|error_log /dev/stderr;|g' /etc/nginx/nginx.conf \
 && (addgroup -S www-data || true) \
 && (adduser -S -G www-data www-data || true)

# Copy data for add-on
COPY rootfs /
COPY index.html /

RUN chmod +x /etc/cont-init.d/nginx.sh /etc/services.d/*/run

# Health check
HEALTHCHECK --interval=60s --timeout=15s --retries=3 CMD curl --fail http://127.0.0.1:80 || exit 1

# Labels
LABEL org.opencontainers.image.title="NGINX"
LABEL org.opencontainers.image.description="Open Source Webserver with PHP and MariaDB."
LABEL org.opencontainers.image.vendor="FaserF's Home Assistant Add-ons"
LABEL org.opencontainers.image.authors="FaserF <https://github.com/FaserF>"
LABEL org.opencontainers.image.licenses="MIT"
LABEL org.opencontainers.image.url="https://github.com/FaserF/hassio-addons/tree/master/nginx"
LABEL org.opencontainers.image.source="https://github.com/FaserF/hassio-addons/tree/master/nginx"
LABEL org.opencontainers.image.documentation="https://github.com/FaserF/hassio-addons/blob/master/nginx/README.md"
# Note: org.opencontainers.image.created should be set via --label during docker build