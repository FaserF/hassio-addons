ARG BUILD_FROM
ARG KOMODO_VERSION
FROM ghcr.io/moghtech/komodo-core:${KOMODO_VERSION} AS komodo
FROM ${BUILD_FROM}

# Set shell
SHELL ["/bin/bash", "-o", "pipefail", "-c"]

# Install requirements
# hadolint ignore=DL3008

# Addon metadata (injected by CI)
ENV ADDON_VERSION="0.0.1"
ENV ADDON_NAME="Komodo"
ENV ADDON_SLUG="komodo"
ENV ADDON_UNSUPPORTED="false"

# hadolint ignore=DL3008
RUN \
    apt-get update \
    && apt-get install -y --no-install-recommends \
        ca-certificates \
        curl \
        gnupg \
        netcat-traditional \
        sudo \
    && curl -fsSL https://www.mongodb.org/static/pgp/server-7.0.asc | \
       gpg -o /usr/share/keyrings/mongodb-server-7.0.gpg --dearmor \
    && echo "deb [ arch,arm64 signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] https://repo.mongodb.org/apt/debian bookworm/mongodb-org/7.0 main" | \
       tee /etc/apt/sources.list.d/mongodb-org-7.0.list \
    && apt-get update \
    && apt-get install -y --no-install-recommends \
        mongodb-org-server \
    && rm -fr \
        /tmp/* \
        /var/{cache,log}/* \
        /var/lib/apt/lists/*

# Copy rootfs
COPY rootfs /

# Copy Komodo binary
COPY --from=komodo /usr/local/bin/core /usr/bin/komodo

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
    org.opencontainers.image.url="https://github.com/FaserF/hassio-addons" \
    org.opencontainers.image.source="${BUILD_REPOSITORY}" \
    org.opencontainers.image.documentation="https://github.com/FaserF/hassio-addons/blob/master/komodo/README.md" \
    org.opencontainers.image.created="${BUILD_DATE}" \
    org.opencontainers.image.revision="${BUILD_REF}" \
    org.opencontainers.image.version="${BUILD_VERSION}"

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD curl --fail http://localhost:9120 || exit 1

RUN chmod a+x /etc/s6-overlay/s6-rc.d/*/run /etc/s6-overlay/s6-rc.d/*/up /etc/s6-overlay/s6-rc.d/*/down || true
