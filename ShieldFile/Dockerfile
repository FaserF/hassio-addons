ARG BUILD_FROM=ghcr.io/home-assistant/amd64-base:alpine
FROM ${BUILD_FROM}

# Install necessary tools
# 'curl' and 'bash' for installing filebrowser
# 'dos2unix' to fix potential Windows line ending issues in scripts
# 'dos2unix' to fix potential Windows line ending issues in scripts
# hadolint ignore=DL3018
RUN apk add --no-cache curl bash dos2unix

# Setup Filebrowser
# We grab the binary from the official install script
# hadolint ignore=DL4006
RUN curl -fsSL https://raw.githubusercontent.com/filebrowser/get/master/get.sh | bash

# Create database directory
RUN mkdir -p /data/database

# Copy Addon run script to S6 services directory
# Copy Run Script
COPY run.sh /run.sh
RUN dos2unix /run.sh && chmod a+x /run.sh

ENTRYPOINT [ "/run.sh" ]

# Labels
LABEL org.opencontainers.image.title="ShieldFile"
LABEL org.opencontainers.image.description="Secure, Web-based File Manager (SFTP over HTTPS)"
LABEL org.opencontainers.image.vendor="FaserF's Home Assistant Add-ons"
LABEL org.opencontainers.image.authors="FaserF <https://github.com/FaserF>"
LABEL org.opencontainers.image.licenses="MIT"
LABEL org.opencontainers.image.url="https://github.com/FaserF/hassio-addons/tree/master/ShieldFile"
LABEL org.opencontainers.image.source="https://github.com/FaserF/hassio-addons/tree/master/ShieldFile"
LABEL org.opencontainers.image.documentation="https://github.com/FaserF/hassio-addons/tree/master/ShieldFile/blob/master/ShieldFile/README.md"
LABEL org.opencontainers.image.created="2025-12-24"
