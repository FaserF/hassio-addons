ARG BUILD_FROM
FROM ghcr.io/plankanban/planka:1.26.3 AS planka

FROM ${BUILD_FROM}

# Set shell
SHELL ["/bin/bash", "-o", "pipefail", "-c"]

# Setup base system


# hadolint ignore=DL3013

# Addon metadata (injected by CI)
ENV ADDON_VERSION="1.1.1"
ENV ADDON_NAME="Planka"
ENV ADDON_SLUG="planka"
ENV ADDON_UNSUPPORTED="false"

RUN \
    apk add --no-cache -u libssl3 libcrypto3 \
        nodejs \
        npm \
        python3 \
        py3-pip \
        postgresql \
        postgresql-contrib \
        nginx \
        curl \
        su-exec \
        openssl \
    && pip3 install --no-cache-dir --break-system-packages setuptools

# Copy Planka
WORKDIR /opt/planka
COPY --from=planka /app/ .

# Copy rootfs
COPY rootfs /

# Set permissions
RUN \
    find /etc/s6-overlay/s6-rc.d -type f -name "*" -exec sed -i 's/\r$//' {} + \
    && chmod a+x /etc/s6-overlay/s6-rc.d/*/run /etc/s6-overlay/s6-rc.d/*/up \
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
