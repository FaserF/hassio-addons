ARG BUILD_FROM=ghcr.io/hassio-addons/base:16.3.3
FROM $BUILD_FROM

# Install Node.js
RUN \
  apk add --no-cache \
    --repository=http://dl-cdn.alpinelinux.org/alpine/edge/main \
    nodejs \
    npm \
    git

WORKDIR /app

# Copy rootfs
COPY rootfs /

# Copy data for add-on
COPY app /app

# Install dependencies
RUN cd /app && npm install
