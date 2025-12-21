ARG BUILD_FROM=ghcr.io/hassio-addons/base:14.1.0
FROM ${BUILD_FROM}

# Install necessary tools
# 'curl' and 'bash' for installing filebrowser
# 'dos2unix' to fix potential Windows line ending issues in scripts
RUN apk add --no-cache curl bash dos2unix

# Setup Filebrowser
# We grab the binary from the official install script
RUN curl -fsSL https://raw.githubusercontent.com/filebrowser/get/master/get.sh | bash

# Create database directory
RUN mkdir -p /data/database

# Copy Addon run script to S6 services directory
RUN mkdir -p /etc/services.d/shieldfile
COPY run.sh /etc/services.d/shieldfile/run

# Fix permissions and line endings (CRLF -> LF)
RUN dos2unix /etc/services.d/shieldfile/run && chmod +x /etc/services.d/shieldfile/run