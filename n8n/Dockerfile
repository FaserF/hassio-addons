ARG BUILD_FROM=ghcr.io/hassio-addons/base:19.0.0
# hadolint ignore=DL3006
FROM ${BUILD_FROM}

# Redeclare ARG after FROM for use in build stage
ARG N8N_VERSION=2.3.1

# Set shell
SHELL ["/bin/bash", "-o", "pipefail", "-c"]

# Setup base
# hadolint ignore=DL3018



# Addon metadata (injected by CI)
ENV ADDON_VERSION="0.1.1"
ENV ADDON_NAME="N8n"
ENV ADDON_SLUG="n8n"
ENV ADDON_UNSUPPORTED="false"

RUN \
    apk add --no-cache --virtual .build-dependencies \
        build-base \
        python3-dev \
    \
    && apk add --no-cache \
        curl \
        nodejs \
        npm \
        python3 \
        sqlite \
    \
    && npm install -g "n8n@${N8N_VERSION}" \
    \
    && apk del --purge .build-dependencies \
    && rm -f -r \
        /root/.npm \
        /root/.cache \
    \
    && n8n --version

# Copy root filesystem
# Copy root filesystem
COPY rootfs /
RUN chmod a+x /etc/services.d/n8n/run

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
    org.opencontainers.image.url="https://github.com/faserf/hassio-addons" \
    org.opencontainers.image.source="https://github.com/faserf/hassio-addons" \
    org.opencontainers.image.documentation="https://github.com/faserf/hassio-addons/blob/master/n8n/README.md" \
    org.opencontainers.image.created="${BUILD_DATE}" \
    org.opencontainers.image.revision="${BUILD_REF}" \
    org.opencontainers.image.version="${BUILD_VERSION}"

# uses s6-overlay from base image

# Health check - using /healthz/readiness which is enabled by default
# (standard /healthz requires additional environment configuration)
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl --fail http://127.0.0.1:5678/healthz/readiness || exit 1
