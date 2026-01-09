ARG BUILD_FROM=ghcr.io/hassio-addons/base:19.0.0
# hadolint ignore=DL3006
FROM ${BUILD_FROM}
ARG BUILD_DATE="1970-01-01T00:00:00Z"

# hadolint ignore=DL3018

# Addon metadata (injected by CI)
ENV ADDON_VERSION="2.1.3"
ENV ADDON_NAME="pterodactyl Wings Gameserver"
ENV ADDON_SLUG="pterodactyl_wings"
ENV ADDON_UNSUPPORTED="false"

RUN apk add --no-cache ca-certificates curl tini tzdata && \
    mkdir -p /etc/pterodactyl /var/log/pterodactyl /tmp/pterodactyl

# Download wings binary with multi-arch support
# Pin to specific version for reproducible builds
ARG WINGS_VERSION=v1.12.0
ENV WINGS_VERSION=${WINGS_VERSION}
ARG TARGETARCH
# SHA256 checksums for version v1.12.0 (from official release)
ARG WINGS_SHA256_AMD64=b8250adebb41f7bf03605753694273b707122d6f11f84f203b23ecc986724577
ARG WINGS_SHA256_ARM64=a219d5a97deccccff1e951f8beb97f0f5b59b256d702b2a06bc91a813886b274
# hadolint ignore=DL4006,SC3040,SC2039
RUN set -o pipefail && \
    if [ "${TARGETARCH}" = "arm64" ]; then ARCH="arm64"; CHECKSUM="${WINGS_SHA256_ARM64}"; else ARCH="amd64"; CHECKSUM="${WINGS_SHA256_AMD64}"; fi && \
    curl -L -o /usr/local/bin/wings "https://github.com/pterodactyl/wings/releases/download/${WINGS_VERSION}/wings_linux_${ARCH}" && \
    echo "${CHECKSUM}  /usr/local/bin/wings" | sha256sum -c - && \
    chmod u+x /usr/local/bin/wings

# Copy rootfs
COPY rootfs /

# Copy data for add-on
COPY run.sh /
RUN chmod a+x /run.sh
CMD [ "/run.sh" ]

# Health check
HEALTHCHECK --interval=60s --timeout=15s --retries=3 CMD curl --fail http://127.0.0.1:8080 || exit 1

# Labels
LABEL org.opencontainers.image.title="pterodactyl Wings Gameserver"
LABEL org.opencontainers.image.description="Open Source Gameserver"
LABEL org.opencontainers.image.vendor="FaserF's Home Assistant Add-ons"
LABEL org.opencontainers.image.authors="FaserF <https://github.com/FaserF>"
LABEL org.opencontainers.image.licenses="MIT"
LABEL org.opencontainers.image.url="https://github.com/FaserF/hassio-addons/tree/master/pterodactyl-wings"
LABEL org.opencontainers.image.source="https://github.com/FaserF/hassio-addons/tree/master/pterodactyl-wings"
LABEL org.opencontainers.image.documentation="https://github.com/FaserF/hassio-addons/blob/master/pterodactyl-wings/README.md"
LABEL org.opencontainers.image.created="${BUILD_DATE}"
