ARG BUILD_FROM=ghcr.io/hassio-addons/base:21.0.2
# hadolint ignore=DL3006
FROM ${BUILD_FROM}
ARG BUILD_DATE="1970-01-01T00:00:00Z"

# hadolint ignore=DL3018

# App metadata (injected by CI)
ENV APP_VERSION="2.4.5"
ENV APP_NAME="pterodactyl Wings Gameserver"
ENV APP_SLUG="pterodactyl_wings"
ENV APP_UNSUPPORTED="false"

RUN \
    echo "http://dl-cdn.alpinelinux.org/alpine/v3.23/main" > /etc/apk/repositories \
    && echo "http://dl-cdn.alpinelinux.org/alpine/v3.23/community" >> /etc/apk/repositories \
    && apk add --no-cache musl musl-dev \
    && apk upgrade --no-cache --available \
    && apk add --no-cache libssl3 libcrypto3 ca-certificates curl tini tzdata && \
    mkdir -p /etc/pterodactyl /var/log/pterodactyl /tmp/pterodactyl

# Download wings binary with multi-arch support
# Pin to specific version for reproducible builds
ARG WINGS_VERSION=v1.13.3
ENV WINGS_VERSION=${WINGS_VERSION}
ARG TARGETARCH
# SHA256 checksums for version v1.13.3 (from official release)
ARG WINGS_SHA256_AMD64=010d894a895fe4f914e3f1c1e75fb2fda4ebe50cc249e7e456887ea5b422c8fa
ARG WINGS_SHA256_ARM64=8e3114cb0ee5ec617831d5ec35097b1096c6c972f05ef80c683a9f396d0fe9f5
# hadolint ignore=DL4006,SC3040,SC2039
RUN set -o pipefail && \
    if [ "${TARGETARCH}" = "arm64" ]; then ARCH="arm64"; CHECKSUM="${WINGS_SHA256_ARM64}"; else ARCH="amd64"; CHECKSUM="${WINGS_SHA256_AMD64}"; fi && \
    curl -L -o /usr/local/bin/wings "https://github.com/pterodactyl/wings/releases/download/${WINGS_VERSION}/wings_linux_${ARCH}" && \
    echo "${CHECKSUM} /usr/local/bin/wings" | sha256sum -c - && \
    chmod u+x /usr/local/bin/wings

# Copy rootfs
COPY rootfs /

# Copy data for add-on
COPY run.sh /
RUN chmod a+x /run.sh
CMD [ "/run.sh" ]

# Health check
HEALTHCHECK --interval=60s --timeout=15s --retries=3 CMD ["/bin/sh", "-c", "curl --fail http://127.0.0.1:8080 || exit 1"]

# Labels
LABEL org.opencontainers.image.title="pterodactyl Wings Gameserver"
LABEL org.opencontainers.image.description="Open Source Gameserver"
LABEL org.opencontainers.image.vendor="FaserF's Home Assistant Apps"
LABEL org.opencontainers.image.authors="FaserF <https://github.com/FaserF>"
LABEL org.opencontainers.image.licenses="MIT"
LABEL org.opencontainers.image.url="https://github.com/FaserF/hassio-addons/tree/master/pterodactyl-wings"
LABEL org.opencontainers.image.source="https://github.com/FaserF/hassio-addons/tree/master/pterodactyl-wings"
LABEL org.opencontainers.image.documentation="https://github.com/FaserF/hassio-addons/blob/master/pterodactyl-wings/README.md"
LABEL org.opencontainers.image.created="${BUILD_DATE}"
