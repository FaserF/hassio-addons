ARG BUILD_FROM=ghcr.io/hassio-addons/base:19.0.0
# hadolint ignore=DL3006
FROM ${BUILD_FROM}
ARG BUILD_DATE="unknown"

# hadolint ignore=DL3018

# Addon metadata (injected by CI)
ENV ADDON_NAME="OpenSSL"
ENV ADDON_SLUG="openssl"
ENV ADDON_UNSUPPORTED="false"

# Addon metadata (injected by CI)
ENV ADDON_VERSION="2.1.1"
ENV ADDON_NAME="OpenSSL"
ENV ADDON_SLUG="openssl"
ENV ADDON_UNSUPPORTED="false"

RUN apk --no-cache add openssl

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
    org.opencontainers.image.vendor="FaserF's Home Assistant Add-ons" \
    org.opencontainers.image.authors="FaserF <https://github.com/FaserF>" \
    org.opencontainers.image.licenses="MIT" \
    org.opencontainers.image.url="https://github.com/FaserF/hassio-addons/tree/master/openssl" \
    org.opencontainers.image.source="https://github.com/FaserF/hassio-addons/tree/master/openssl" \
    org.opencontainers.image.documentation="https://github.com/FaserF/hassio-addons/blob/master/openssl/README.md" \
    org.opencontainers.image.created="${BUILD_DATE}"
