ARG BUILD_FROM
FROM ghcr.io/plankanban/planka:2.1.0 AS planka

FROM ${BUILD_FROM}

# Set shell
SHELL ["/bin/bash", "-o", "pipefail", "-c"]

# Setup base system
# hadolint ignore=DL3013

# App metadata (injected by CI)
ENV APP_VERSION="1.3.1"
ENV APP_NAME="Planka"
ENV APP_SLUG="planka"
ENV APP_UNSUPPORTED="false"

RUN \
    echo "http://dl-cdn.alpinelinux.org/alpine/v3.23/main" > /etc/apk/repositories \
    && echo "http://dl-cdn.alpinelinux.org/alpine/v3.23/community" >> /etc/apk/repositories \
    && apk add --no-cache musl musl-dev \
    && apk upgrade --no-cache --available \
    && apk add --no-cache libssl3 libcrypto3 \
        nodejs \
        npm \
        python3 \
        py3-pip \
        postgresql \
        postgresql-contrib \
        nginx \
        curl \
        su-exec \
        openssl \
        squid \
    && pip3 install --no-cache-dir --break-system-packages setuptools==75.8.0

# Copy Planka
WORKDIR /opt/planka
COPY --from=planka /app/ .

# Copy rootfs
COPY rootfs /

# Set permissions
RUN \
    find /etc/s6-overlay/s6-rc.d /usr/lib/bashio -type f -name "*" -exec sed -i 's/\r$//' {} + \
    && chmod a+x /etc/s6-overlay/s6-rc.d/*/run /etc/s6-overlay/s6-rc.d/*/up \
    && { chmod a+x /etc/s6-overlay/s6-rc.d/*/*.sh 2>/dev/null || true; }

# Labels
LABEL \
    org.opencontainers.image.title="Planka" \
    org.opencontainers.image.description="The elegant open source project tracking tool" \
    org.opencontainers.image.vendor="FaserF's Home Assistant Apps" \
    org.opencontainers.image.authors="FaserF <https://github.com/FaserF>" \
    org.opencontainers.image.licenses="MIT" \
    org.opencontainers.image.url="https://github.com/FaserF/hassio-addons/tree/master/planka" \
    org.opencontainers.image.source="https://github.com/FaserF/hassio-addons/tree/master/planka" \
    org.opencontainers.image.documentation="https://github.com/FaserF/hassio-addons/blob/master/planka/README.md" \
    org.opencontainers.image.created="${BUILD_DATE}"

# Healthcheck
HEALTHCHECK \
    --interval=30s \
    --timeout=30s \
    --start-period=30s \
    --retries=3 \
    CMD curl --fail http://127.0.0.1:1337 || exit 1
