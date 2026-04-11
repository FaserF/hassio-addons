ARG BUILD_FROM=ghcr.io/hassio-addons/base:20.0.3
# hadolint ignore=DL3006
FROM ${BUILD_FROM}
ARG BUILD_DATE="1970-01-01T00:00:00Z"

# Create directory for apache2 to store PID file
# Create directory for apache2 to store PID file and install dependencies
# hadolint ignore=DL3018,DL3047

# Set shell with pipefail for Alpine (busybox/ash)
SHELL ["/bin/ash", "-o", "pipefail", "-c"]

# App metadata (injected by CI)
ENV APP_VERSION="3.3.1"
ENV APP_NAME="Apache2"
ENV APP_SLUG="apache2"
ENV APP_UNSUPPORTED="false"

WORKDIR /tmp

# renovate: datasource=github-releases depName=php/php-src
ARG PHP_VERSION="8.5"

# renovate: datasource=repology depName=alpine_3_21/apache2 versioning=loose
ARG APACHE2_VERSION="2.4.66-r0"

# Excluded due to low usage but high increase of image size: libxml2-dev, php85-dev, php85-pecl-xdebug, mosquitto-dev
# hadolint ignore=DL3018,DL3047,DL4006,DL3003
RUN mkdir /run/apache2 \
    && echo "http://dl-cdn.alpinelinux.org/alpine/v3.23/main" > /etc/apk/repositories \
    && echo "http://dl-cdn.alpinelinux.org/alpine/v3.23/community" >> /etc/apk/repositories \
    && echo "http://dl-cdn.alpinelinux.org/alpine/v3.23/testing" >> /etc/apk/repositories \
    && apk upgrade --no-cache --available \
    && apk add --no-cache libcrypto3 libssl3 \
    apache2${APACHE2_VERSION:+=$APACHE2_VERSION} \
    curl \
    jq \
    && PHP_V=$(echo "${PHP_VERSION}" | cut -d. -f1-2 | tr -d '.') \
    && apk add --no-cache \
    "php${PHP_V}-apache2" \
    apache2-utils \
    apache2-mod-wsgi \
    apache2-ssl \
    apache2-proxy \
    "php${PHP_V}" \
    "php${PHP_V}-fpm" \
    "php${PHP_V}-mysqli" \
    "php${PHP_V}-mysqlnd" \
    "php${PHP_V}-opcache" \
    "php${PHP_V}-gd" \
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
    musl-locales \
    && rm -f /var/www/localhost/htdocs/index.html

# Configure Logging
# shellcheck disable
RUN sed -i -r 's@Errorlog .*@Errorlog /dev/stderr@i' /etc/apache2/httpd.conf \
 && echo "Transferlog /dev/stdout" >> /etc/apache2/httpd.conf \
 && (addgroup -S www-data || true) \
 && (adduser -S -G www-data www-data || true)

# Copy data for add-on
COPY rootfs /
COPY index.html /

RUN chmod +x /etc/cont-init.d/apache2.sh /etc/services.d/apache2/run /usr/bin/webserver_app_integration.sh

# Health check
HEALTHCHECK --interval=60s --timeout=15s --retries=3 CMD curl --fail http://127.0.0.1:80 || exit 1

# Labels
LABEL org.opencontainers.image.title="Apache2"
LABEL org.opencontainers.image.description="Open Source Webserver with PHP and MariaDB."
LABEL org.opencontainers.image.vendor="FaserF's Home Assistant Apps"
LABEL org.opencontainers.image.authors="FaserF <https://github.com/FaserF>"
LABEL org.opencontainers.image.licenses="MIT"
LABEL org.opencontainers.image.url="https://github.com/FaserF/hassio-addons/tree/master/apache2"
LABEL org.opencontainers.image.source="https://github.com/FaserF/hassio-addons/tree/master/apache2"
LABEL org.opencontainers.image.documentation="https://github.com/FaserF/hassio-addons/blob/master/apache2/README.md"
LABEL org.opencontainers.image.created="${BUILD_DATE}"
