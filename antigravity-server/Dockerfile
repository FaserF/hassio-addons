# https://developers.home-assistant.io/docs/add-ons/configuration#add-on-dockerfile
ARG BUILD_FROM=ghcr.io/hassio-addons/debian-base:9.1.0
# hadolint ignore=DL3006
FROM ${BUILD_FROM}

# renovate: datasource=github-releases depName=Eidolf/Docker-AntiGravity versioning=loose
ARG ANTIGRAVITY_VERSION="2025.12.0-nightly.20251226.1451"
ARG BUILD_DATE="1970-01-01T00:00:00Z"

# Set shell
SHELL ["/bin/bash", "-o", "pipefail", "-c"]

# Install dependencies for NoVNC and VNC server
# hadolint ignore=DL3008
RUN \
    apt-get update \
    && apt-get install -y --no-install-recommends \
        coreutils \
        expect \
        curl \
        dbus-x11 \
        git \
        nginx \
        novnc \
        python3 \
        python3-numpy \
        tigervnc-standalone-server \
        tigervnc-common \
        tigervnc-tools \
        xfce4 \
        xfce4-terminal \
        fonts-noto \
        fonts-noto-color-emoji \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/* \
    && mkdir -p /run/nginx

# Setup NoVNC
RUN ln -sf /usr/share/novnc/vnc_lite.html /usr/share/novnc/index.html

# Copy S6-Overlay services
COPY rootfs /
RUN chmod -R +x /etc/s6-overlay/s6-rc.d/*/run

# Healthcheck - verify NoVNC is responding
HEALTHCHECK --interval=60s --timeout=10s --start-period=120s --retries=3 \
    CMD curl --fail http://127.0.0.1:6080/ || exit 1

# Labels
LABEL org.opencontainers.image.title="Antigravity-Server"
LABEL org.opencontainers.image.description="Stream the Antigravity AI IDE (Linux Desktop with XFCE4) via NoVNC in your browser."
LABEL org.opencontainers.image.vendor="FaserF's Home Assistant Add-ons"
LABEL org.opencontainers.image.authors="FaserF <https://github.com/FaserF>"
LABEL org.opencontainers.image.licenses="MIT"
LABEL org.opencontainers.image.url="https://github.com/FaserF/hassio-addons/tree/master/antigravity-server"
LABEL org.opencontainers.image.source="https://github.com/FaserF/hassio-addons/tree/master/antigravity-server"
LABEL org.opencontainers.image.documentation="https://github.com/FaserF/hassio-addons/blob/master/antigravity-server/README.md"
LABEL org.opencontainers.image.created="${BUILD_DATE}"
LABEL org.opencontainers.image.version="${ANTIGRAVITY_VERSION}"
