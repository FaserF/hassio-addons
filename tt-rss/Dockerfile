ARG BUILD_FROM
FROM $BUILD_FROM

# Setup base
# hadolint ignore=DL3003

# App metadata (injected by CI)
ENV APP_VERSION="1.2.1"
ENV APP_NAME="Tiny Tiny RSS"
ENV APP_SLUG="tt-rss"
ENV APP_UNSUPPORTED="false"

RUN \
    echo "http://dl-cdn.alpinelinux.org/alpine/v3.23/main" > /etc/apk/repositories \
    && echo "http://dl-cdn.alpinelinux.org/alpine/v3.23/community" >> /etc/apk/repositories \
    && apk add --no-cache --available musl musl-dev \
    && apk upgrade --no-cache --available \
    && apk add --no-cache libssl3 libcrypto3 \
        nginx \
        postgresql \
        postgresql-contrib \
        php85 \
        php85-curl \
        php85-dom \
        php85-fileinfo \
        php85-fpm \
        php85-gd \
        php85-iconv \
        php85-intl \
        php85-json \
        php85-mbstring \
        php85-mysqlnd \
        php85-openssl \
        php85-pdo \
        php85-pdo_mysql \
        php85-pdo_pgsql \
        php85-pdo_sqlite \
        php85-pecl-apcu \
        php85-pcntl \
        php85-pgsql \
        php85-phar \
        php85-posix \
        php85-session \
        php85-simplexml \
        php85-sqlite3 \
        php85-tokenizer \
        php85-xml \
        php85-xmlwriter \
        php85-zip \
        git \
        openssl \
    \
    && ln -sf /usr/bin/php85 /usr/bin/php \
    \
    && git clone --depth 1 https://git.tt-rss.org/fox/tt-rss.git /var/www/tt-rss \
    \
    && rm -rf /var/www/tt-rss/.git

# Copy root filesystem
COPY rootfs /

# Move custom PHP config to correct location for PHP 8.5
RUN if [ -d /etc/php ]; then cp -r /etc/php/* /etc/php85/ && rm -rf /etc/php; fi

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
    org.opencontainers.image.vendor="FaserF's Home Assistant Apps" \
    org.opencontainers.image.authors="FaserF <https://github.com/FaserF>" \
    org.opencontainers.image.licenses="MIT" \
    org.opencontainers.image.url="https://github.com/${BUILD_REPOSITORY}" \
    org.opencontainers.image.source="https://github.com/${BUILD_REPOSITORY}" \
    org.opencontainers.image.documentation="https://github.com/${BUILD_REPOSITORY}/blob/main/README.md" \
    org.opencontainers.image.created="${BUILD_DATE}" \
    org.opencontainers.image.revision="${BUILD_REF}" \
    org.opencontainers.image.version="${BUILD_VERSION}"

HEALTHCHECK \
    CMD curl --fail http://127.0.0.1:8280/ || exit 1
