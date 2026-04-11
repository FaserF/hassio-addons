ARG BUILD_FROM=ghcr.io/hassio-addons/base:20.0.3
# hadolint ignore=DL3006
FROM ${BUILD_FROM}
# Base image includes s6-overlay; services use /usr/bin/with-contenv
ARG BUILD_DATE="1970-01-01T00:00:00Z"

# renovate: datasource=repology depName=alpine_edge/nginx versioning=loose
ARG NGINX_VERSION="1.28.3-r0"

# Set shell with pipefail for Alpine (busybox/ash)
SHELL ["/bin/ash", "-o", "pipefail", "-c"]

# renovate: datasource=repology depName=alpine_edge/php85 versioning=loose
ARG PHP_VERSION="8.5"

# App metadata (injected by CI)
ENV APP_VERSION="0.3.1"
ENV APP_NAME="NGINX"
ENV APP_SLUG="nginx"
ENV APP_UNSUPPORTED="false"

WORKDIR /tmp

# Create directory for nginx to store PID file and install dependencies
# hadolint ignore=DL3018,DL3003
RUN mkdir -p /run/nginx /var/log/nginx /var/lib/nginx \
  && echo "http://dl-cdn.alpinelinux.org/alpine/v3.23/main" > /etc/apk/repositories \
  && echo "http://dl-cdn.alpinelinux.org/alpine/v3.23/community" >> /etc/apk/repositories \
  && apk upgrade --no-cache --available \
  && apk --no-cache add libssl3 libcrypto3 \
    nginx${NGINX_VERSION:+=$NGINX_VERSION} \
    curl \
    jq \
    && PHP_V=$(echo "${PHP_VERSION}" | awk -F. '{print $1$2}') \
    && apk add --no-cache \
    "php${PHP_V}-fpm" \
    "php${PHP_V}" \
    "php${PHP_V}-mysqli" \
    "php${PHP_V}-mysqlnd" \
    "php${PHP_V}-opcache" \
    "php${PHP_V}-gd" \
    zlib \
    "php${PHP_V}-intl" \
    "php${PHP_V}-curl" \
    "php${PHP_V}-phar" \
    "php${PHP_V}-mbstring" \
    "php${PHP_V}-zip" \
    "php${PHP_V}-xml" \
    "php${PHP_V}-iconv" \
    "php${PHP_V}-pdo" \
    "php${PHP_V}-pdo_mysql" \
    "php${PHP_V}-pdo_sqlite" \
    "php${PHP_V}-session" \
    "php${PHP_V}-ctype" \
    "php${PHP_V}-simplexml" \
    "php${PHP_V}-dom" \
    "php${PHP_V}-tokenizer" \
    "php${PHP_V}-xmlreader" \
    "php${PHP_V}-xmlwriter" \
    "php${PHP_V}-fileinfo" \
    "php${PHP_V}-xmlrpc" \
    "php${PHP_V}-soap" \
    "php${PHP_V}-gettext" \
    "php${PHP_V}-bz2" \
    "php${PHP_V}-shmop" \
    "php${PHP_V}-posix" \
    "php${PHP_V}-ldap" \
    "php${PHP_V}-pecl-redis" \
    "php${PHP_V}-pecl-imagick" \
    "php${PHP_V}-pecl-mcrypt" \
    "php${PHP_V}-sqlite3" \
    "php${PHP_V}-bcmath" \
    "php${PHP_V}-calendar" \
    "php${PHP_V}-exif" \
    "php${PHP_V}-ftp" \
    "php${PHP_V}-sysvsem" \
    "php${PHP_V}-sysvshm" \
    "php${PHP_V}-sysvmsg" \
    "php${PHP_V}-pcntl" \
    "php${PHP_V}-sodium" \
    "php${PHP_V}-cgi" \
    "php${PHP_V}-sockets" \
    "php${PHP_V}-imap" \
    "php${PHP_V}-apcu" \
    mosquitto \
    mariadb-client \
    ffmpeg \
    musl-locales

# Configure Logging
# shellcheck disable=SC2015
RUN sed -i 's|access_log /var/log/nginx/access.log;|access_log /dev/stdout;|g' /etc/nginx/nginx.conf \
 && sed -i 's|error_log /var/log/nginx/error.log;|error_log /dev/stderr;|g' /etc/nginx/nginx.conf \
 && (addgroup -S www-data || true) \
 && (adduser -S -G www-data www-data || true)

# Copy data for add-on
COPY rootfs /
COPY index.html /

RUN chmod +x /etc/cont-init.d/nginx.sh /etc/services.d/*/run /usr/bin/webserver_app_integration.sh

# Health check
HEALTHCHECK --interval=60s --timeout=15s --retries=3 CMD curl --fail http://127.0.0.1:80 || exit 1

# Labels
LABEL org.opencontainers.image.title="NGINX"
LABEL org.opencontainers.image.description="Open Source Webserver with PHP and MariaDB."
LABEL org.opencontainers.image.vendor="FaserF's Home Assistant Apps"
LABEL org.opencontainers.image.authors="FaserF <https://github.com/FaserF>"
LABEL org.opencontainers.image.licenses="MIT"
LABEL org.opencontainers.image.url="https://github.com/FaserF/hassio-addons/tree/master/nginx"
LABEL org.opencontainers.image.source="https://github.com/FaserF/hassio-addons/tree/master/nginx"
LABEL org.opencontainers.image.documentation="https://github.com/FaserF/hassio-addons/blob/master/nginx/README.md"
# Note: org.opencontainers.image.created should be set via --label during docker build
