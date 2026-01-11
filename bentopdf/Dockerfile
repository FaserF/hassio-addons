ARG BUILD_FROM=ghcr.io/hassio-addons/base:19.0.0
# hadolint ignore=DL3006
# renovate: datasource=docker depName=bentopdf/bentopdf
FROM bentopdf/bentopdf:v1.15.3 AS builder

# hadolint ignore=DL3006
FROM ${BUILD_FROM}

# Set shell
SHELL ["/bin/bash", "-o", "pipefail", "-c"]

# Install Nginx
# hadolint ignore=DL3018

# Addon metadata (injected by CI)
ENV ADDON_VERSION="1.0.1"
ENV ADDON_NAME="BentoPDF"
ENV ADDON_SLUG="bentopdf"
ENV ADDON_UNSUPPORTED="false"

RUN    apk add --no-cache \
        nginx \
        curl \
    && rm -f /etc/nginx/http.d/default.conf

# Copy rootfs
COPY rootfs /

# Copy artifacts from builder
COPY --from=builder /usr/share/nginx/html /var/www/bentopdf

# Fix permissions
RUN \
    mkdir -p /run/nginx \
    && chown -R nginx:nginx /var/www/bentopdf /run/nginx

# S6-Overlay
ENV S6_BEHAVIOUR_IF_STAGE2_FAILS=2

# Health check
HEALTHCHECK --start-period=10s --interval=60s --timeout=5s --retries=5 \
    CMD curl --fail http://127.0.0.1:8035 || exit 1

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
    org.opencontainers.image.source="https://github.com/FaserF/hassio-addons" \
    org.opencontainers.image.documentation="https://github.com/FaserF/hassio-addons/blob/master/bentopdf/README.md" \
    org.opencontainers.image.created="${BUILD_DATE}" \
    org.opencontainers.image.revision="${BUILD_REF}" \
    org.opencontainers.image.version="${BUILD_VERSION}"
