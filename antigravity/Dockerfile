ARG BUILD_FROM=ghcr.io/hassio-addons/base:21.0.1
FROM ${BUILD_FROM}

# Set shell
SHELL ["/bin/bash", "-o", "pipefail", "-c"]

# App metadata
ARG BUILD_DATE="1970-01-01T00:00:00Z"
ENV APP_VERSION="1.0.0"
ENV APP_NAME="Antigravity"
ENV APP_SLUG="antigravity"
ENV APP_UNSUPPORTED="false"

ENV PIP_BREAK_SYSTEM_PACKAGES=1 \
    PYO3_USE_ABI3_FORWARD_COMPATIBILITY=1

# Setup base system & Python runtime
RUN \
    apk add --no-cache \
        python3 \
        py3-pip \
        py3-pydantic \
        py3-pydantic-core \
        py3-fastapi \
        py3-uvicorn \
        py3-httpx \
        curl \
        openssl \
        libssl3 \
        libcrypto3 \
    && pip3 install --no-cache-dir --break-system-packages \
        google-auth==2.38.0

# Copy rootfs
COPY rootfs /

# Set permissions
RUN \
    find /etc/s6-overlay/s6-rc.d -type f -name "*" -exec sed -i 's/\r$//' {} + \
    && chmod a+x /etc/s6-overlay/s6-rc.d/*/run /etc/s6-overlay/s6-rc.d/*/up 2>/dev/null || true \
    && { chmod a+x /etc/s6-overlay/s6-rc.d/*/*.sh 2>/dev/null || true; } \
    && mkdir -p /data/antigravity

# Labels
LABEL \
    org.opencontainers.image.title="Antigravity" \
    org.opencontainers.image.description="Google Antigravity Quota Monitor, Multi-Account Dashboard, and Polling Gateway" \
    org.opencontainers.image.vendor="FaserF's Home Assistant Apps" \
    org.opencontainers.image.authors="FaserF <https://github.com/FaserF>" \
    org.opencontainers.image.licenses="MIT" \
    org.opencontainers.image.url="https://github.com/FaserF/hassio-addons/tree/master/antigravity" \
    org.opencontainers.image.source="https://github.com/FaserF/hassio-addons/tree/master/antigravity" \
    org.opencontainers.image.documentation="https://github.com/FaserF/hassio-addons/blob/master/antigravity/README.md" \
    org.opencontainers.image.created="${BUILD_DATE}"

# Healthcheck
HEALTHCHECK \
    --interval=30s \
    --timeout=10s \
    --start-period=15s \
    --retries=3 \
    CMD ["/bin/sh", "-c", "curl --fail http://127.0.0.1:8199/healthz || exit 1"]
