ARG BUILD_FROM
FROM $BUILD_FROM

# Setup base
# hadolint ignore=DL3003
RUN \
    apk add --no-cache \
        nginx=1.26.2-r4 \
        php83=8.3.15-r0 \
        php83-curl=8.3.15-r0 \
        php83-dom=8.3.15-r0 \
        php83-fileinfo=8.3.15-r0 \
        php83-fpm=8.3.15-r0 \
        php83-gd=8.3.15-r0 \
        php83-iconv=8.3.15-r0 \
        php83-intl=8.3.15-r0 \
        php83-json=8.3.15-r0 \
        php83-mbstring=8.3.15-r0 \
        php83-mysqlnd=8.3.15-r0 \
        php83-opcache=8.3.15-r0 \
        php83-openssl=8.3.15-r0 \
        php83-pdo=8.3.15-r0 \
        php83-pdo_mysql=8.3.15-r0 \
        php83-pdo_pgsql=8.3.15-r0 \
        php83-pdo_sqlite=8.3.15-r0 \
        php83-pecl-apcu=5.1.24-r0 \
        php83-pgsql=8.3.15-r0 \
        php83-phar=8.3.15-r0 \
        php83-posix=8.3.15-r0 \
        php83-session=8.3.15-r0 \
        php83-simplexml=8.3.15-r0 \
        php83-sqlite3=8.3.15-r0 \
        php83-tokenizer=8.3.15-r0 \
        php83-xml=8.3.15-r0 \
        php83-xmlwriter=8.3.15-r0 \
        php83-zip=8.3.15-r0 \
        git=2.47.1-r0 \
    \
    && ln -s /usr/bin/php83 /usr/bin/php \
    \
    && git clone --depth=1 https://git.tt-rss.org/fox/tt-rss.git /var/www/tt-rss \
    \
    && rm -rf /var/www/tt-rss/.git

# Copy root filesystem
COPY rootfs /

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
