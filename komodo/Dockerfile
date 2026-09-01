ARG BUILD_FROM=ghcr.io/hassio-addons/debian-base:9.4.0
ARG KOMODO_VERSION=2.3.3
FROM mongo:8.3 AS mongo
FROM ghcr.io/moghtech/komodo-core:${KOMODO_VERSION} AS komodo
FROM ${BUILD_FROM}

# Set shell
SHELL ["/bin/bash", "-o", "pipefail", "-c"]

# Install requirements
# hadolint ignore=DL3008,SC3009

# App metadata (injected by CI)
ENV APP_VERSION="0.2.5"
ENV APP_NAME="Komodo"
ENV APP_SLUG="komodo"
ENV APP_UNSUPPORTED="false"

RUN \
    apt-get update \
    && apt-get install -y --no-install-recommends \
        ca-certificates \
        curl \
        netcat-traditional \
        sudo \
        libcurl4 \
        libssl3 \
    && groupadd -r mongodb && useradd -r -g mongodb mongodb \
    && mkdir -p /data/db \
    && chown -R mongodb:mongodb /data/db \
    && rm -fr \
        /tmp/* \
        /var/cache/* \
        /var/log/* \
        /var/lib/apt/lists/*

# Copy rootfs
COPY rootfs /

# Copy Komodo and MongoDB binaries
COPY --from=komodo /usr/local/bin/core /usr/bin/komodo
COPY --from=mongo /usr/bin/mongod /usr/bin/mongod
COPY --from=mongo /usr/bin/mongos /usr/bin/mongos

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
    org.opencontainers.image.url="https://github.com/FaserF/hassio-addons" \
    org.opencontainers.image.source="${BUILD_REPOSITORY}" \
    org.opencontainers.image.documentation="https://github.com/FaserF/hassio-addons/blob/master/komodo/README.md" \
    org.opencontainers.image.created="${BUILD_DATE}" \
    org.opencontainers.image.revision="${BUILD_REF}" \
    org.opencontainers.image.version="${BUILD_VERSION}"

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD ["/bin/sh", "-c", "curl --fail http://localhost:9120 || exit 1"]

RUN chmod a+x /etc/s6-overlay/s6-rc.d/*/run /etc/s6-overlay/s6-rc.d/*/up /etc/s6-overlay/s6-rc.d/*/down || true
