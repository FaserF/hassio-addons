ARG BUILD_FROM=ghcr.io/hassio-addons/base:20.0.0
# hadolint ignore=DL3006
FROM ${BUILD_FROM}

# Set shell
SHELL ["/bin/bash", "-o", "pipefail", "-c"]

ARG WORDPRESS_VERSION="6.8"

# Setup base

# hadolint ignore=DL3018,DL3003

# Addon metadata (injected by CI)
ENV ADDON_VERSION="0.2.0"
ENV ADDON_NAME="Wordpress"
ENV ADDON_SLUG="wordpress"
ENV ADDON_UNSUPPORTED="false"

RUN \
    apk add --no-cache \
        nginx \
        mariadb-client \
        openssl \
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
    && curl -J -L -o /tmp/wordpress.tar.gz \
        "https://wordpress.org/wordpress-${WORDPRESS_VERSION}.tar.gz" \
    # SHA256 from https://wordpress.org/wordpress-6.8.tar.gz.sha256 (verified 2026-01)
    && echo "f7dbedc423ddb3f2f3e98e9140f1720bfd6d4a8f4873c85da2e62f6a078de10a  /tmp/wordpress.tar.gz" | sha256sum -c - \
    && mkdir -p /usr/src/wordpress \
    && tar zxvf /tmp/wordpress.tar.gz -C /usr/src/wordpress --strip-components=1 \
    && rm -f /tmp/wordpress.tar.gz \
    && curl -L -o /usr/local/bin/wp "https://github.com/wp-cli/wp-cli/releases/download/v2.12.0/wp-cli-2.12.0.phar" \
    && echo "ce34ddd838f7351d6759068d09793f26755463b4a4610a5a5c0a97b68220d85c  /usr/local/bin/wp" | sha256sum -c - \
    && chmod +x /usr/local/bin/wp \
    # Create PHP symlinks
    && ln -sf /usr/bin/php84 /usr/bin/php \
    && ln -sf /usr/sbin/php-fpm84 /usr/sbin/php-fpm \
    # Cleanup
    && rm -f /etc/nginx/http.d/default.conf \
    && rm -rf /var/cache/apk/*

# Copy root filesystem
COPY rootfs /

RUN find /etc/s6-overlay/s6-rc.d -mindepth 2 -name run -exec chmod +x {} \;

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
    CMD curl --fail http://127.0.0.1:80/ || exit 1
