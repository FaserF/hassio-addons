ARG BUILD_FROM=ghcr.io/hassio-addons/base:19.0.0
# hadolint ignore=DL3006
# hadolint ignore=DL3006
# renovate: datasource=docker depName=filebrowser/filebrowser
FROM filebrowser/filebrowser:v2.32.0 AS filebrowser

FROM ${BUILD_FROM}
ARG BUILD_DATE

# Install necessary tools
# 'curl' and 'bash' for installing filebrowser (kept for compatibility if needed, but binary is copied)
# 'dos2unix' to fix potential Windows line ending issues in scripts
# Setup Filebrowser
# We grab the binary from the official image
# hadolint ignore=DL3018,DL4006
RUN apk add --no-cache curl bash dos2unix openssl \
    && mkdir -p /data/database

COPY --from=filebrowser /filebrowser /usr/local/bin/filebrowser

# Copy Addon run script to S6 services directory
# Copy Run Script
COPY run.sh /run.sh
RUN dos2unix /run.sh && chmod a+x /run.sh

# Healthcheck
HEALTHCHECK \
    CMD curl --fail http://127.0.0.1:80/ || exit 1

CMD [ "/run.sh" ]

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
