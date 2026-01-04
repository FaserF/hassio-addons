ARG BUILD_FROM=ghcr.io/hassio-addons/base:19.0.0
# hadolint ignore=DL3006
FROM ${BUILD_FROM}

# Set shell
SHELL ["/bin/bash", "-o", "pipefail", "-c"]

ARG WORDPRESS_VERSION="6.7.1"

# Setup base

# hadolint ignore=DL3018,DL3003
RUN \
    apk add --no-cache \
        nginx \
        mariadb-client \
        php84 \
        php84-fpm \
        php84-mysqli \
        php84-openssl \
        php84-curl \
        php84-zlib \
        php84-xml \
        php84-phar \
        php84-intl \
        php84-dom \
        php84-ctype \
        php84-session \
        php84-mbstring \
        php84-gd \
        php84-iconv \
        php84-zip \
        php84-fileinfo \
    \
    && curl -J -L -o /tmp/wordpress.tar.gz \
        "https://wordpress.org/wordpress-${WORDPRESS_VERSION}.tar.gz" \
    && mkdir -p /usr/src/wordpress \
    && tar zxvf /tmp/wordpress.tar.gz -C /usr/src/wordpress --strip-components=1 \
    && rm -f /tmp/wordpress.tar.gz \
    \
    # Cleanup
    && rm -rf /var/cache/apk/*

# Copy root filesystem
COPY rootfs /

RUN chmod +x /etc/s6-overlay/s6-rc.d/*/run /etc/s6-overlay/s6-rc.d/*/up /etc/s6-overlay/s6-rc.d/*/down


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
    org.opencontainers.image.vendor="HASSIO-ADDONS" \
    org.opencontainers.image.authors="FaserF <https://github.com/FaserF>" \
    org.opencontainers.image.licenses="MIT" \
    org.opencontainers.image.url="https://github.com/hassio-addons/addon-wordpress" \
    org.opencontainers.image.source="https://github.com/${BUILD_REPOSITORY}" \
    org.opencontainers.image.documentation="https://github.com/${BUILD_REPOSITORY}/blob/main/README.md" \
    org.opencontainers.image.created="${BUILD_DATE}" \
    org.opencontainers.image.revision="${BUILD_REF}" \
    org.opencontainers.image.version="${BUILD_VERSION}"

# Health check
HEALTHCHECK \
    --interval=1m \
    --timeout=15s \
    --retries=3 \
    CMD curl --fail http://127.0.0.1:8099/ || exit 1
