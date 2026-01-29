ARG BUILD_FROM=ghcr.io/hassio-addons/base:20.0.1
# hadolint ignore=DL3006
FROM $BUILD_FROM
ARG BUILD_DATE="unknown"

# Set shell
SHELL ["/bin/bash", "-o", "pipefail", "-c"]

# 1. Install Node.js & Git (Using standard repos for stability)
# hadolint ignore=DL3018

# Addon metadata (injected by CI)
ENV ADDON_VERSION="1.2.1"
ENV ADDON_NAME="WhatsApp"
ENV ADDON_SLUG="whatsapp"
ENV ADDON_UNSUPPORTED="false"

RUN \
 apk add --no-cache -u libssl3 libcrypto3 \
        nodejs \
        npm \
        git \
        curl

# 2. Set workdir
WORKDIR /opt/whatsapp

# 3. Copy EVERYTHING from the context
COPY . .

# 4. Move rootfs to root (Standard HA Addon structure) & Fix Windows Line Enddings
# hadolint ignore=DL3018
    RUN \
 apk add --no-cache "dos2unix~=7.5" && \
    if [ -d "rootfs" ]; then \
        cp -rv rootfs/* /; \
        # Fix potential Windows CRLF in s6 scripts
        find /etc/s6-overlay -type f -exec dos2unix {} \;; \
        find /etc/s6-overlay -name run -exec chmod +x {} \;; \
        find /etc/s6-overlay -name finish -exec chmod +x {} \;; \
        find /etc/services.d -type f -exec dos2unix {} \; || true; \
        find /etc/services.d -name run -exec chmod +x {} \; || true; \
    fi

# 5. Setup App
RUN \
    if [ -d "app" ]; then \
        mv app/* ./; \
        # FORCE CLEAN INSTALL: Delete lockfile and node_modules to avoid version conflicts
        rm -rf package-lock.json node_modules; \
        npm install; \
        # Extract Baileys version for runtime banner
        BAILEYS_VERSION=$(node -p "require('./node_modules/@whiskeysockets/baileys/package.json').version" 2>/dev/null || echo "unknown"); \
        echo "BAILEYS_VERSION=${BAILEYS_VERSION}" >> /etc/environment; \
    fi

# Build arguments
ARG BUILD_ARCH
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
    maintainer="FaserF"

# Labels
LABEL \
    org.opencontainers.image.title="WhatsApp" \
    org.opencontainers.image.description="Home Assistant WhatsApp Backend (Baileys/Node.js)" \
    org.opencontainers.image.vendor="FaserF's Home Assistant Add-ons" \
    org.opencontainers.image.authors="FaserF <https://github.com/FaserF>" \
    org.opencontainers.image.licenses="MIT" \
    org.opencontainers.image.url="https://github.com/FaserF/hassio-addons/tree/master/whatsapp" \
    org.opencontainers.image.source="https://github.com/FaserF/hassio-addons/tree/master/whatsapp" \
    org.opencontainers.image.documentation="https://github.com/FaserF/hassio-addons/blob/master/whatsapp/README.md" \
    org.opencontainers.image.created="${BUILD_DATE}"

# Healthcheck - reduced start-period since service starts quickly
HEALTHCHECK --interval=10s --timeout=5s --start-period=5s --retries=2 \
    CMD curl --fail -s http://127.0.0.1:8066/health || exit 1
