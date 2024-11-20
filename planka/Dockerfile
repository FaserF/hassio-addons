ARG BUILD_FROM=ghcr.io/hassio-addons/base:16.3.1
FROM ${BUILD_FROM}

SHELL ["/bin/bash", "-o", "pipefail", "-c"]

# Setup base
RUN apk add --no-cache wget tar

# Set the version of Planka to use as an argument
ARG PLANKA_VERSION="v1.23.0"

# Download and extract Planka prebuilt release
WORKDIR /planka
RUN wget https://github.com/plankanban/planka/releases/download/${PLANKA_VERSION}/planka-prebuild-${PLANKA_VERSION}.zip && \
    unzip planka-prebuild-${PLANKA_VERSION}.zip -d /planka && \
    rm planka-prebuild-${PLANKA_VERSION}.zip

# Set permissions for runtime
RUN addgroup -g 1000 node && \
    adduser -u 1000 -G node -s /bin/sh -D node && \
    chown -R node:node /planka

# Copy entry point script
COPY run.sh /run.sh
RUN chmod +x /run.sh

USER node
CMD ["/run.sh"]
