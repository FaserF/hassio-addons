ARG BUILD_FROM=ghcr.io/hassio-addons/base:19.0.0
# hadolint ignore=DL3006
FROM ${BUILD_FROM}
ARG BUILD_DATE="1970-01-01T00:00:00Z"

# hadolint ignore=DL3018
RUN apk add --no-cache ca-certificates curl tini tzdata && \
    mkdir -p /etc/pterodactyl /var/log/pterodactyl /tmp/pterodactyl

# Download wings binary with multi-arch support
# Pin to specific version for reproducible builds
ARG WINGS_VERSION=v1.11.13
ARG TARGETARCH
# SHA256 checksums for version 1.11.13 (from official release notes)
ARG WINGS_SHA256_AMD64=aca5fa45ddf1c10f092c16dd758b920d8a3fa9f91c37aacc62745e72958bf71a
ARG WINGS_SHA256_ARM64=a3d71e8c67e261fdd287f73dcab98d2a55dbba9ce001794e0006e4ed88fafe6a
# hadolint ignore=DL4006,SC3040
RUN set -o pipefail && \
    if [ "${TARGETARCH}" = "arm64" ]; then ARCH="arm64"; CHECKSUM="${WINGS_SHA256_ARM64}"; else ARCH="amd64"; CHECKSUM="${WINGS_SHA256_AMD64}"; fi && \
    curl -L -o /usr/local/bin/wings "https://github.com/pterodactyl/wings/releases/download/${WINGS_VERSION}/wings_linux_${ARCH}" && \
    echo "${CHECKSUM}  /usr/local/bin/wings" | sha256sum -c - && \
    chmod u+x /usr/local/bin/wings

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
