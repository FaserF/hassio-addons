ARG BUILD_FROM=ghcr.io/hassio-addons/base:20.0.1
# hadolint ignore=DL3006
# renovate: datasource=docker depName=filebrowser/filebrowser
FROM filebrowser/filebrowser:v2.56.0 AS filebrowser

# hadolint ignore=DL3006
FROM ${BUILD_FROM}
ARG BUILD_DATE="1970-01-01T00:00:00Z"

# Software version (from image tag above)
ENV FILEBROWSER_VERSION="v2.53.1"

# Install necessary tools
# 'curl' and 'bash' for installing filebrowser (kept for compatibility if needed, but binary is copied)
# 'dos2unix' to fix potential Windows line ending issues in scripts
# Setup Filebrowser
# We grab the binary from the official image
# hadolint ignore=DL3018,DL4006

# Addon metadata (injected by CI)
ENV ADDON_VERSION="2.2.4"
ENV ADDON_NAME="ShieldFile"
ENV ADDON_SLUG="shieldfile"
ENV ADDON_UNSUPPORTED="false"

RUN apk add --no-cache -u libssl3 libcrypto3 curl bash dos2unix openssl nginx \
    && mkdir -p /data/database

COPY --from=filebrowser /bin/filebrowser /usr/local/bin/filebrowser

# Copy rootfs
COPY rootfs /

# Set S6 behavior to fail the container if any service fails
ENV S6_BEHAVIOUR_IF_STAGE2_FAILS=2

# Set executable permissions
RUN chmod a+x /etc/s6-overlay/s6-rc.d/*/run /etc/s6-overlay/s6-rc.d/*/up /etc/s6-overlay/s6-rc.d/*/down || true

# Healthcheck
HEALTHCHECK \
    --start-period=60s --interval=30s --timeout=10s --retries=3 \
    CMD curl --fail http://127.0.0.1:8098/ || exit 1

# Labels
LABEL org.opencontainers.image.title="ShieldFile"
LABEL org.opencontainers.image.description="Secure, Web-based File Manager (SFTP over HTTPS)"
LABEL org.opencontainers.image.vendor="FaserF's Home Assistant Add-ons"
LABEL org.opencontainers.image.authors="FaserF <https://github.com/FaserF>"
LABEL org.opencontainers.image.licenses="MIT"
LABEL org.opencontainers.image.url="https://github.com/FaserF/hassio-addons/tree/master/ShieldFile"
LABEL org.opencontainers.image.source="https://github.com/FaserF/hassio-addons/tree/master/ShieldFile"
LABEL org.opencontainers.image.documentation="https://github.com/FaserF/hassio-addons/blob/master/ShieldFile/README.md"
LABEL org.opencontainers.image.created="${BUILD_DATE}"
