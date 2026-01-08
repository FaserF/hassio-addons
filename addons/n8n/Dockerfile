ARG BUILD_FROM=ghcr.io/hassio-addons/base:16.3.1
ARG N8N_VERSION=2.2.4
# hadolint ignore=DL3006
FROM ${BUILD_FROM}

# Set shell
SHELL ["/bin/bash", "-o", "pipefail", "-c"]

# Setup base
# hadolint ignore=DL3018
RUN \
    apk add --no-cache --virtual .build-dependencies \
        build-base \
        python3-dev \
    \
    && apk add --no-cache \
        nodejs \
        npm \
        python3 \
        sqlite \
    \
    && npm install -g "n8n@${N8N_VERSION}" \
    \
    && apk del --no-cache --purge .build-dependencies \
    && rm -f -r \
        /root/.npm \
        /root/.cache \
    \
    && n8n --version

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
    org.opencontainers.image.url="https://github.com/faserf/hassio-addons" \
    org.opencontainers.image.source="https://github.com/faserf/hassio-addons" \
    org.opencontainers.image.documentation="https://github.com/faserf/hassio-addons/blob/master/addons/n8n/README.md" \
    org.opencontainers.image.created="${BUILD_DATE}" \
    org.opencontainers.image.revision="${BUILD_REF}" \
    org.opencontainers.image.version="${BUILD_VERSION}"

# Health check
HEALTHCHECK \
    CMD curl --fail http://127.0.0.1:5678/healthz || exit 1
