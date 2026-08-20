ARG BUILD_FROM=ghcr.io/hassio-addons/base:21.0.2
# hadolint ignore=DL3006
FROM $BUILD_FROM
ARG BUILD_DATE="unknown"

# Set shell
SHELL ["/bin/bash", "-o", "pipefail", "-c"]

# App metadata
ENV APP_VERSION="0.1.0"
ENV APP_NAME="Trade Republic Headless Browser"
ENV APP_SLUG="traderepublic"
ENV APP_UNSUPPORTED="false"

# 1. Install Alpine packages (Python3, Chromium, ca-certificates, minimal dependencies)
# hadolint ignore=DL3018
RUN \
    ALPINE_VERSION=$(cat /etc/alpine-release 2>/dev/null | cut -d. -f1,2 || echo "3.24") && \
    echo "http://dl-cdn.alpinelinux.org/alpine/v${ALPINE_VERSION}/main" > /etc/apk/repositories && \
    echo "http://dl-cdn.alpinelinux.org/alpine/v${ALPINE_VERSION}/community" >> /etc/apk/repositories && \
    apk add --no-cache \
        python3 \
        py3-pip \
        chromium \
        ca-certificates \
        ttf-freefont \
        curl \
        jq \
        "dos2unix~=7.5" && \
    echo "ALPINE_VERSION=$(cat /etc/alpine-release 2>/dev/null || echo unknown)" >> /etc/environment

# 2. Set workdir
WORKDIR /opt/traderepublic

# 3. Copy project files
COPY . .

# 4. Move rootfs to root & fix line endings
RUN \
    if [ -d "rootfs" ]; then \
        cp -rv rootfs/* /; \
        find /etc/s6-overlay -type f -exec dos2unix {} \;; \
        find /etc/s6-overlay -name run -exec chmod +x {} \;; \
        find /etc/s6-overlay -name finish -exec chmod +x {} \;; \
        if [ -d "/etc/services.d" ]; then \
            find /etc/services.d -type f -exec dos2unix {} \; || true; \
            find /etc/services.d -name run -exec chmod +x {} \; || true; \
        fi; \
    fi

# 5. Pure Python dependencies (no musl wheel compilation issues)
RUN \
    pip3 install --no-cache-dir --break-system-packages \
        fastapi \
        uvicorn[standard] \
        jinja2 \
        aiohttp \
        websockets \
        pydantic

# 6. Setup App folder
RUN \
    if [ -d "app" ]; then \
        mv app/* ./; \
        rm -rf app; \
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

LABEL \
    org.opencontainers.image.title="Trade Republic" \
    org.opencontainers.image.description="Home Assistant Trade Republic Headless Browser Session Provider" \
    org.opencontainers.image.vendor="FaserF's Home Assistant Apps" \
    org.opencontainers.image.authors="FaserF <https://github.com/FaserF>" \
    org.opencontainers.image.licenses="MIT" \
    org.opencontainers.image.url="https://github.com/FaserF/hassio-addons/tree/master/traderepublic" \
    org.opencontainers.image.source="https://github.com/FaserF/hassio-addons/tree/master/traderepublic" \
    org.opencontainers.image.documentation="https://github.com/FaserF/hassio-addons/blob/master/traderepublic/README.md" \
    org.opencontainers.image.created="${BUILD_DATE}"

# Healthcheck
HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
    CMD ["/bin/sh", "-c", "curl --fail -s http://127.0.0.1:8095/api/v1/status || exit 1"]