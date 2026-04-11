ARG BUILD_FROM=ghcr.io/hassio-addons/base:20.0.3
# hadolint ignore=DL3006
FROM ${BUILD_FROM}
ARG BUILD_DATE="unknown"

# hadolint ignore=DL3018

# App metadata (injected by CI)
ENV APP_VERSION="2.3.1"
ENV APP_NAME="OpenSSL"
ENV APP_SLUG="openssl"
ENV APP_UNSUPPORTED="false"

RUN \
    echo "http://dl-cdn.alpinelinux.org/alpine/v3.23/main" > /etc/apk/repositories \
    && echo "http://dl-cdn.alpinelinux.org/alpine/v3.23/community" >> /etc/apk/repositories \
    && apk add --no-cache --available musl musl-dev \
    && apk upgrade --no-cache --available \
    && apk add --no-cache libssl3 libcrypto3 openssl

# Copy data for add-on
WORKDIR /
COPY run.sh /etc/services.d/openssl/run
RUN chmod +x /etc/services.d/openssl/run

HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD /usr/bin/openssl rand -base64 8 > /dev/null 2>&1 || exit 1

# Labels
LABEL \
    org.opencontainers.image.title="OpenSSL" \
    org.opencontainers.image.description="Generate self-signed certificates" \
    org.opencontainers.image.vendor="FaserF's Home Assistant Apps" \
    org.opencontainers.image.authors="FaserF <https://github.com/FaserF>" \
    org.opencontainers.image.licenses="MIT" \
    org.opencontainers.image.url="https://github.com/FaserF/hassio-addons/tree/master/openssl" \
    org.opencontainers.image.source="https://github.com/FaserF/hassio-addons/tree/master/openssl" \
    org.opencontainers.image.documentation="https://github.com/FaserF/hassio-addons/blob/master/openssl/README.md" \
    org.opencontainers.image.created="${BUILD_DATE}"
