ARG BUILD_FROM=ghcr.io/hassio-addons/base:20.0.1
###############################################################################
# Get prebuild containers from Vaultwarden
###############################################################################
FROM "vaultwarden/server:1.35.2-alpine" AS vaultwarden

###############################################################################
# Build the actual add-on.
###############################################################################
# hadolint ignore=DL3006
FROM ${BUILD_FROM}

# Set shell
SHELL ["/bin/bash", "-o", "pipefail", "-c"]

# Environment variables
ENV LOG_LEVEL="info"

# Get the Bitwarden from official images
COPY --from=vaultwarden /vaultwarden /opt/vaultwarden
COPY --from=vaultwarden /web-vault /opt/web-vault

# add Nginx
# Addon metadata (injected by CI)
ENV ADDON_VERSION="0.3.2"
ENV ADDON_NAME="Vaultwarden (Bitwarden) (Custom)"
ENV ADDON_SLUG="vaultwarden"
ENV ADDON_UNSUPPORTED="false"
ENV LOG_LEVEL="info"

RUN \
    apk add --no-cache --upgrade \
        curl \
        jq \
        dos2unix \
        mariadb-connector-c \
        libpq \
        nginx \
        sqlite \
        openssl \
        libssl3 \
        libcrypto3 \
    \
    && mkdir -p /var/log/nginx \
    && touch /var/log/nginx/error.log

# Healthcheck
HEALTHCHECK --interval=30s --timeout=30s --start-period=5s --retries=3 \
    CMD curl --fail --insecure https://localhost:7277 || exit 1

# Copy root filesystem
COPY rootfs /

# Set executable permissions and fix line endings for S6 structure
RUN find /etc/s6-overlay/s6-rc.d -type f -exec dos2unix {} + \
    && find /etc/s6-overlay/s6-rc.d -type f \( -name "run" -o -name "up" -o -name "down" \) -exec chmod +x {} + \
    && if [ -d "/etc/cont-init.d" ]; then \
        find /etc/cont-init.d -type f -exec dos2unix {} + \
        && find /etc/cont-init.d -type f -exec chmod +x {} +; \
    fi

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
    io.hass.version=${BUILD_VERSION} \
    maintainer="FaserF" \
    org.opencontainers.image.title="${BUILD_NAME}" \
    org.opencontainers.image.description="${BUILD_DESCRIPTION}" \
    org.opencontainers.image.vendor="FaserF's Home Assistant Add-ons" \
    org.opencontainers.image.authors="FaserF" \
    org.opencontainers.image.licenses="MIT" \
    org.opencontainers.image.url="https://github.com/faserf/hassio-addons" \
    org.opencontainers.image.source="https://github.com/${BUILD_REPOSITORY}" \
    org.opencontainers.image.documentation="https://github.com/${BUILD_REPOSITORY}/blob/master/vaultwarden/DOCS.md" \
    org.opencontainers.image.created=${BUILD_DATE} \
    org.opencontainers.image.revision=${BUILD_REF} \
    org.opencontainers.image.version=${BUILD_VERSION}
