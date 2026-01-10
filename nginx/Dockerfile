ARG BUILD_FROM=ghcr.io/hassio-addons/base:19.0.0
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
ENV ADDON_VERSION="0.1.3"
ENV ADDON_NAME="NGINX"
ENV ADDON_SLUG="nginx"
ENV ADDON_UNSUPPORTED="false"

WORKDIR /tmp
# hadolint ignore=DL3018,DL3003
RUN mkdir -p /run/nginx /var/log/nginx /var/lib/nginx \
    && apk --no-cache add \
    nginx${NGINX_VERSION:+=$NGINX_VERSION} \
    curl \
    jq \
    php84-fpm \
    php84 \
    php84-mysqli \
    php84-opcache \
    php84-gd \
    zlib \
    php84-curl \
    php84-phar \
    php84-mbstring \
    php84-zip \
    php84-pdo \
    php84-pdo_mysql \
    php84-iconv \
    php84-dom \
    php84-session \
    php84-intl \
    php84-soap \
    php84-fileinfo \
    php84-xml \
    php84-ctype \
    php84-pdo_sqlite \
    php84-tokenizer \
    php84-exif \
    php84-xmlwriter \
    php84-cgi \
    php84-simplexml \
    php84-sockets \
    php84-json \
    php84-imap \
    php84-apcu \
    mosquitto \
    mariadb-client \
    ffmpeg \
    cmake make musl-dev gcc gettext-dev libintl libxml2 git \
    && git clone --depth 1 --branch master https://gitlab.com/rilian-la-te/musl-locales.git musl-locales-master \
    && cd musl-locales-master \
    && cmake -DLOCALE_PROFILE=OFF -D CMAKE_INSTALL_PREFIX:PATH=/usr . && make && make install \
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
