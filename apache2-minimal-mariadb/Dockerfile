ARG BUILD_FROM=ghcr.io/hassio-addons/base:20.0.1

# hadolint ignore=DL3006
FROM ${BUILD_FROM}
ARG BUILD_DATE="1970-01-01T00:00:00Z"

# Create directory for apache2 to store PID file and install dependencies

# shellcheck disable=SC2015

# Set shell with pipefail for Alpine (busybox/ash)
SHELL ["/bin/ash", "-o", "pipefail", "-c"]

# renovate: datasource=github-releases depName=php/php-src
ARG PHP_VERSION="8.5"

# hadolint ignore=DL4006

# Addon metadata (injected by CI)
ENV ADDON_VERSION="3.2.1"
ENV ADDON_NAME="Apache2 Minimal with MariaDB Client"
ENV ADDON_SLUG="apache2-minimal-mariadb"
ENV ADDON_UNSUPPORTED="false"

RUN mkdir /run/apache2 \
 && apk --no-cache -u add libcrypto3 libssl3 \
    apache2 \
    curl \
    jq \
    && PHP_V=$(echo "${PHP_VERSION}" | cut -d. -f1-2 | tr -d '.') \
    && apk add --no-cache \
    --repository=http://dl-cdn.alpinelinux.org/alpine/edge/community \
    --repository=http://dl-cdn.alpinelinux.org/alpine/edge/main \
    --repository=http://dl-cdn.alpinelinux.org/alpine/edge/testing \
    "php${PHP_V}-apache2" \
    libxml2-dev \
    apache2-utils \
    apache2-mod-wsgi \
    apache2-ssl \
    "php${PHP_V}" \
    "php${PHP_V}-mysqli" \
    "php${PHP_V}-curl" \
    "php${PHP_V}-mbstring" \
    "php${PHP_V}-zip" \
    mariadb-client \
    && sed -i -r 's@Errorlog .*@Errorlog /dev/stderr@i' /etc/apache2/httpd.conf \
    && echo "Transferlog /dev/stdout" >> /etc/apache2/httpd.conf \
    && (addgroup -S www-data || true) \
    && (adduser -S -G www-data www-data || true)

# Copy data for add-on
# Health check
HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
    CMD curl --fail http://127.0.0.1:80 || exit 1

COPY rootfs /
COPY index.html /

RUN chmod +x /etc/cont-init.d/apache2.sh /etc/services.d/apache2/run

# Labels
LABEL org.opencontainers.image.title="Apache2 Minimal with MariaDB Client"
LABEL org.opencontainers.image.description="Open Source Webserver with MariaDB Client and some PHP Modules."
LABEL org.opencontainers.image.vendor="FaserF's Home Assistant Add-ons"
LABEL org.opencontainers.image.authors="FaserF <https://github.com/FaserF>"
LABEL org.opencontainers.image.licenses="MIT"
LABEL org.opencontainers.image.url="https://github.com/FaserF/hassio-addons/tree/master/apache2-minimal-mariadb"
LABEL org.opencontainers.image.source="https://github.com/FaserF/hassio-addons/tree/master/apache2-minimal-mariadb"
LABEL org.opencontainers.image.documentation="https://github.com/FaserF/hassio-addons/blob/master/apache2-minimal-mariadb/README.md"
LABEL org.opencontainers.image.created="${BUILD_DATE}"
