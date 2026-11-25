ARG BUILD_FROM=ghcr.io/hassio-addons/base:21.0.11
# hadolint ignore=DL3006
FROM ${BUILD_FROM}
ARG BUILD_DATE="1970-01-01T00:00:00Z"

# Create directory for apache2 to store PID file
# Create directory for apache2 to store PID file and install dependencies
# hadolint ignore=DL3018,DL3047

# Set shell with pipefail for Alpine (busybox/ash)
SHELL ["/bin/ash", "-o", "pipefail", "-c"]

# App metadata (injected by CI)
ENV APP_VERSION="3.4.14"
ENV APP_NAME="Apache2"
ENV APP_SLUG="apache2"
ENV APP_UNSUPPORTED="false"
ENV S6_BEHAVIOUR_IF_STAGE2_FAILS=2

WORKDIR /tmp

# renovate: datasource=github-releases depName=php/php-src
ARG PHP_VERSION="8.5"

# renovate: datasource=repology depName=alpine_3_21/apache2 versioning=loose
ARG APACHE2_VERSION="2.4.71-r0"

# Excluded due to low usage but high increase of image size: libxml2-dev, php85-dev, php85-pecl-xdebug, mosquitto-dev
# hadolint ignore=DL3018,DL3047,DL4006,DL3003
RUN mkdir /run/apache2 \
    && echo "http://dl-cdn.alpinelinux.org/alpine/v3.23/main" > /etc/apk/repositories \
    && echo "http://dl-cdn.alpinelinux.org/alpine/v3.23/community" >> /etc/apk/repositories \
    && echo "@edge http://dl-cdn.alpinelinux.org/alpine/edge/community" >> /etc/apk/repositories \
    && echo "@edgemain http://dl-cdn.alpinelinux.org/alpine/edge/main" >> /etc/apk/repositories \
    && apk add --no-cache musl musl-dev \
    && apk upgrade --no-cache --available \
    && apk add --no-cache libcrypto3 libssl3 \
    apache2${APACHE2_VERSION:+=$APACHE2_VERSION} \
    curl \
    jq \
    icu-data-en@edgemain \
    icu-libs@edgemain \
    && PHP_V=$(echo "${PHP_VERSION}" | cut -d. -f1-2 | tr -d '.') \
    && apk add --no-cache \
    "php${PHP_V}-common@edge" \
    "php${PHP_V}-openssl@edge" \
    "php${PHP_V}-apache2@edge" \
    apache2-utils \
    apache2-mod-wsgi \
    apache2-ssl \
    apache2-proxy \
    "php${PHP_V}@edge" \
    "php${PHP_V}-fpm@edge" \
    "php${PHP_V}-mysqli@edge" \
    "php${PHP_V}-mysqlnd@edge" \
    "php${PHP_V}-gd@edge" \
    "php${PHP_V}-intl@edge" \
    "php${PHP_V}-curl@edge" \
    "php${PHP_V}-phar@edge" \
    "php${PHP_V}-mbstring@edge" \
    "php${PHP_V}-zip@edge" \
    "php${PHP_V}-xml@edge" \
    "php${PHP_V}-iconv@edge" \
    "php${PHP_V}-pdo@edge" \
    "php${PHP_V}-pdo_mysql@edge" \
    "php${PHP_V}-pdo_sqlite@edge" \
    "php${PHP_V}-session@edge" \
    "php${PHP_V}-ctype@edge" \
    "php${PHP_V}-simplexml@edge" \
    "php${PHP_V}-dom@edge" \
    "php${PHP_V}-tokenizer@edge" \
    "php${PHP_V}-xmlreader@edge" \
    "php${PHP_V}-xmlwriter@edge" \
    "php${PHP_V}-fileinfo@edge" \
    "php${PHP_V}-soap@edge" \
    "php${PHP_V}-gettext@edge" \
    "php${PHP_V}-bz2@edge" \
    "php${PHP_V}-shmop@edge" \
    "php${PHP_V}-posix@edge" \
    "php${PHP_V}-ldap@edge" \
    "php${PHP_V}-pecl-redis@edge" \
    "php${PHP_V}-pecl-imagick@edge" \
    "php${PHP_V}-sqlite3@edge" \
    "php${PHP_V}-bcmath@edge" \
    "php${PHP_V}-calendar@edge" \
    "php${PHP_V}-exif@edge" \
    "php${PHP_V}-ftp@edge" \
    "php${PHP_V}-sysvsem@edge" \
    "php${PHP_V}-sysvshm@edge" \
    "php${PHP_V}-sysvmsg@edge" \
    "php${PHP_V}-pcntl@edge" \
    "php${PHP_V}-sodium@edge" \
    "php${PHP_V}-cgi@edge" \
    "php${PHP_V}-sockets@edge" \
    "php${PHP_V}-pecl-imap@edge" \
    "php${PHP_V}-pecl-apcu@edge" \
    mosquitto \
    mariadb-client \
    ffmpeg \
    musl-locales \
    && rm -f /var/www/localhost/htdocs/index.html

# Configure Logging
# shellcheck disable
RUN sed -i -r 's@Errorlog .*@Errorlog /dev/stderr@i' /etc/apache2/httpd.conf \
 && sed -i 's/User apache/User www-data/' /etc/apache2/httpd.conf \
 && sed -i 's/Group apache/Group www-data/' /etc/apache2/httpd.conf \
 && echo "Transferlog /dev/stdout" >> /etc/apache2/httpd.conf \
 && (addgroup -S www-data || true) \
 && (adduser -S -G www-data www-data || true)

# Copy data for add-on
COPY rootfs /
COPY index.html /

RUN chmod +x /etc/cont-init.d/apache2.sh /etc/services.d/apache2/run /usr/bin/webserver_app_integration.sh

# Health check
HEALTHCHECK --interval=60s --timeout=15s --retries=3 CMD ["curl", "--fail", "http://127.0.0.1:80"]

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
