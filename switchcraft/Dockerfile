ARG BUILD_FROM=ghcr.io/hassio-addons/debian-base/amd64:9.1.0
# hadolint ignore=DL3006
FROM ${BUILD_FROM}

# Set shell
SHELL ["/bin/bash", "-o", "pipefail", "-c"]

# Setup application directory



# Addon metadata (injected by CI)
ENV ADDON_VERSION="0.1.0"
ENV ADDON_NAME="SwitchCraft"
ENV ADDON_SLUG="switchcraft"
ENV ADDON_UNSUPPORTED="false"

WORKDIR /app

# Install dependencies (Python, Wine, Support)
# hadolint ignore=DL3008
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        python3 \
        python3-pip \
        python3-venv \
        python3-dev \
        build-essential \
        wine \
        unzip \
        curl \
        ca-certificates \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Copy rootfs
COPY rootfs /

# Ensure S6 scripts are executable
RUN chmod +x /etc/s6-overlay/s6-rc.d/switchcraft/run

# Install Python requirements and SwitchCraft
# renovate: datasource=github-tags depName=FaserF/SwitchCraft
ARG SWITCHCRAFT_VERSION="v2026.1.5b2"
# shellcheck disable=SC2102
# hadolint ignore=DL3013,SC2102
RUN curl -L -o /tmp/switchcraft.tar.gz https://github.com/FaserF/SwitchCraft/archive/refs/tags/${SWITCHCRAFT_VERSION}.tar.gz \
    && tar xf /tmp/switchcraft.tar.gz -C /app --strip-components=1 \
    && rm /tmp/switchcraft.tar.gz \
    # Install dependencies (mirroring upstream Dockerfile)
    && pip3 install --break-system-packages --no-cache-dir .[web-server] flet flet-web flet-charts packaging \
    # Generate Addons
    && python3 src/generate_addons.py \
    # Install bundled addons
    && mkdir -p /root/.switchcraft/addons \
    && shopt -s nullglob \
    && for zip in /app/src/switchcraft/assets/addons/*.zip; do \
        unzip -o "$zip" -d "/root/.switchcraft/addons/$(basename "$zip" .zip)"; \
    done \
    && shopt -u nullglob

# Environment variables
ENV FLET_SERVER_IP=0.0.0.0
ENV FLET_SERVER_PORT=8080
ENV FLET_FORCE_WEB_SOCKET=true
ENV FLET_REMOTE_ADDR_HEADER=X-Forwarded-For
ENV FLET_WEB_URL=http://localhost:8080
ENV FLET_ENTRY_URL=http://localhost:8080
ENV SC_DISABLE_WINGET_INSTALL=1

# Symlink assets
RUN ln -s /app/src/switchcraft/assets /app/assets

# CR-Skip-PythonBaseCheck
# Build arguments
ARG BUILD_ARCH
ARG BUILD_DATE="1970-01-01T00:00:00Z"
ARG BUILD_DESCRIPTION
ARG BUILD_NAME
ARG BUILD_REF
ARG BUILD_REPOSITORY
ARG BUILD_VERSION

# Health Check
HEALTHCHECK --interval=30s --timeout=10s --retries=5 --start-period=30s \
  CMD curl --fail http://127.0.0.1:8080 || exit 1

# Labels
LABEL \
    io.hass.name="${BUILD_NAME}" \
    io.hass.description="${BUILD_DESCRIPTION}" \
    io.hass.arch="${BUILD_ARCH}" \
    io.hass.type="addon" \
    io.hass.version="${BUILD_VERSION}" \
    maintainer="FaserF" \
    org.opencontainers.image.title="${BUILD_NAME}" \
    org.opencontainers.image.description="${BUILD_DESCRIPTION}" \
    org.opencontainers.image.vendor="FaserF's Home Assistant Add-ons" \
    org.opencontainers.image.authors="FaserF <https://github.com/FaserF>" \
    org.opencontainers.image.licenses="MIT" \
    org.opencontainers.image.url="https://github.com/FaserF/hassio-addons/tree/master/switchcraft" \
    org.opencontainers.image.source="https://github.com/FaserF/hassio-addons/tree/master/switchcraft" \
    org.opencontainers.image.documentation="https://github.com/FaserF/hassio-addons/blob/master/switchcraft/README.md" \
    org.opencontainers.image.created="${BUILD_DATE}"
