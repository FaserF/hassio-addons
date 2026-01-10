ARG BUILD_FROM
FROM $BUILD_FROM

# Setup base
# hadolint ignore=DL3003

# Addon metadata (injected by CI)
ENV ADDON_VERSION="0.1.0"
ENV ADDON_NAME="Tiny Tiny RSS"
ENV ADDON_SLUG="tt-rss"
ENV ADDON_UNSUPPORTED="false"

RUN \
    apk add --no-cache \
        nginx \
        postgresql \
        postgresql-contrib \
        php84 \
        php84-curl \
        php84-dom \
        php84-fileinfo \
        php84-fpm \
        php84-gd \
        php84-iconv \
        php84-intl \
        php84-json \
        php84-mbstring \
        php84-mysqlnd \
        php84-opcache \
        php84-openssl \
        php84-pdo \
        php84-pdo_mysql \
        php84-pdo_pgsql \
        php84-pdo_sqlite \
        php84-pecl-apcu \
        php84-pgsql \
        php84-phar \
        php84-posix \
        php84-session \
        php84-simplexml \
        php84-sqlite3 \
        php84-tokenizer \
        php84-xml \
        php84-xmlwriter \
        php84-zip \
        git \
        openssl \
    \
    && ln -s /usr/bin/php84 /usr/bin/php \
    \
    && git clone --depth=1 https://git.tt-rss.org/fox/tt-rss.git /var/www/tt-rss \
    \
    && rm -rf /var/www/tt-rss/.git

# Copy root filesystem
COPY rootfs /

# Move custom PHP config to correct location for PHP 8.4
RUN if [ -d /etc/php ]; then cp -r /etc/php/* /etc/php84/ && rm -rf /etc/php; fi

# Set permissions
RUN \
    find /etc/s6-overlay/s6-rc.d -type f -name "*" -exec sed -i 's/\r$//' {} + \
    && chmod -R 755 /etc/s6-overlay/s6-rc.d

# Build arguments
ARG BUILD_ARCH
ARG BUILD_DATE
ARG BUILD_DESCRIPTION
ARG BUILD_NAME
ARG BUILD_REF
ARG BUILD_REPOSITORY
ARG BUILD_VERSION

# Labels
LABEL \
    io.hass.name="${BUILD_NAME}" \
    io.hass.description="${BUILD_DESCRIPTION}" \
    io.hass.arch="${BUILD_ARCH}" \
    io.hass.type="addon" \
    io.hass.version="${BUILD_VERSION}" \
    maintainer="FaserF <https://github.com/FaserF>" \
    org.opencontainers.image.title="${BUILD_NAME}" \
    org.opencontainers.image.description="${BUILD_DESCRIPTION}" \
    org.opencontainers.image.vendor="FaserF's Home Assistant Add-ons" \
    org.opencontainers.image.authors="FaserF <https://github.com/FaserF>" \
    org.opencontainers.image.licenses="MIT" \
    org.opencontainers.image.url="https://github.com/${BUILD_REPOSITORY}" \
    org.opencontainers.image.source="https://github.com/${BUILD_REPOSITORY}" \
    org.opencontainers.image.documentation="https://github.com/${BUILD_REPOSITORY}/blob/main/README.md" \
    org.opencontainers.image.created="${BUILD_DATE}" \
    org.opencontainers.image.revision="${BUILD_REF}" \
    org.opencontainers.image.version="${BUILD_VERSION}"

HEALTHCHECK \
    CMD curl --fail http://127.0.0.1:80/ || exit 1
