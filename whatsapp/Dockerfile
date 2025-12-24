ARG BUILD_FROM=ghcr.io/hassio-addons/base:19.0.0
FROM $BUILD_FROM

# Set shell
SHELL ["/bin/bash", "-o", "pipefail", "-c"]

# 1. Install Node.js & Git (Using standard repos for stability)
# hadolint ignore=DL3018
RUN \
    apk add --no-cache \
        nodejs \
        npm \
        git

# 2. Set workdir
WORKDIR /opt/whatsapp

# 3. Copy EVERYTHING from the context
COPY . .

# 4. Move rootfs to root (Standard HA Addon structure) & Fix Windows Line Enddings
RUN \
    apk add --no-cache dos2unix && \
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
    io.hass.version="${BUILD_VERSION}" \
    maintainer="FaserF"
