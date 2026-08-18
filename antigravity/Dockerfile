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

# Setup base system & Python runtime
RUN \
    apk add --no-cache \
        musl \
        musl-dev \
        libssl3 \
        libcrypto3 \
        python3 \
        py3-pip \
        curl \
        openssl \
    && pip3 install --no-cache-dir --break-system-packages \
        uvicorn==0.34.0 \
        fastapi==0.115.8 \
        httpx==0.28.1 \
        pydantic==2.10.6 \
        google-auth==2.38.0 \
        starlette==0.45.3

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
