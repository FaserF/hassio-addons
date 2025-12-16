ARG BUILD_FROM=ghcr.io/hassio-addons/base:14.1.0
FROM ${BUILD_FROM}

# Setup Filebrowser
# We grab the binary from the official image or download it.
# Downloading ensures arch compatibility if using 'curl' logic, but copying from image is safer for multi-arch builds if Buildx handles it.
# Base image supports multi-arch, so let's try direct copy from filebrowser multi-arch image or just install curl/bash and fetch it.
# Easiest: Copy from filebrowser/filebrowser if we assume same arch mapping, but HA buildx handles this.

# Let's use the official method for HA addons which often installs binaries directly.
# Filebrowser provides an install script.
RUN curl -fsSL https://raw.githubusercontent.com/filebrowser/get/master/get.sh | bash

# Create directories
RUN mkdir -p /data/database

# Copy Addon run script
COPY run.sh /run.sh
RUN chmod +x /run.sh

# Start the addon
CMD [ "/run.sh" ]
