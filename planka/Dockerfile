ARG BUILD_FROM
FROM ghcr.io/plankanban/planka:1.24.1 AS planka

FROM ${BUILD_FROM}

# Set shell
SHELL ["/bin/bash", "-o", "pipefail", "-c"]

# Setup base system
# hadolint ignore=DL3013
RUN \
    apk add --no-cache \
        nodejs \
        npm \
        python3 \
        py3-pip \
        postgresql \
        postgresql-contrib \
        nginx \
        curl \
    # hadolint ignore=DL3013
    && pip3 install --no-cache-dir --break-system-packages setuptools

# Copy Planka
WORKDIR /opt/planka
COPY --from=planka /app/ .

# Copy rootfs
COPY rootfs /

# Set permissions
RUN \
    chmod a+x /etc/s6-overlay/s6-rc.d/*/run \
    && { chmod a+x /etc/s6-overlay/s6-rc.d/*/*.sh 2>/dev/null || true; }

# Labels
LABEL \
    org.opencontainers.image.title="Planka" \
    org.opencontainers.image.description="The elegant open source project tracking tool" \
    org.opencontainers.image.vendor="FaserF's Home Assistant Add-ons" \
    org.opencontainers.image.authors="FaserF <https://github.com/FaserF>" \
    org.opencontainers.image.licenses="MIT" \
    org.opencontainers.image.url="https://github.com/FaserF/hassio-addons/tree/master/planka" \
    org.opencontainers.image.source="https://github.com/FaserF/hassio-addons/tree/master/planka" \
    org.opencontainers.image.documentation="https://github.com/FaserF/hassio-addons/blob/master/planka/README.md" \
    org.opencontainers.image.created="${BUILD_DATE}"

# Healthcheck
HEALTHCHECK \
    CMD curl --fail http://127.0.0.1:1337 || exit 1
