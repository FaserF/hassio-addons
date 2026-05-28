# https://developers.home-assistant.io/docs/apps/configuration#app-dockerfile
ARG BUILD_FROM=ghcr.io/hassio-addons/debian-base:9.3.0
# hadolint ignore=DL3006
FROM ${BUILD_FROM}

ARG BUILD_DATE="1970-01-01T00:00:00Z"
ARG BUILD_VERSION="1.0.0"

# Set shell and ENV
SHELL ["/bin/bash", "-o", "pipefail", "-c"]
ENV DEBIAN_FRONTEND=noninteractive

# App metadata (injected by CI)
ENV APP_VERSION="1.0.0"
ENV APP_NAME="Antigravity Agent"
ENV APP_SLUG="antigravity-agent"
ENV APP_UNSUPPORTED="false"

# 1. Install base development tools & Python/Node.js dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
        ca-certificates \
        gnupg \
        lsb-release \
        curl \
        wget \
        git \
        jq \
        zip \
        unzip \
        build-essential \
        python3 \
        python3-pip \
        python3-venv \
        python3-dev \
        dos2unix \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

# 2. Install Node.js (v24.x)
RUN curl -fsSL https://deb.nodesource.com/setup_24.x | bash - && \
    apt-get update && apt-get install -y --no-install-recommends nodejs && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

# 3. Install google-antigravity CLI using the official installer (May 2026 version)
RUN curl -fsSL https://antigravity.google/cli/install.sh | bash

# 4. Install gemini-cli globally via npm
RUN npm install -g @google/gemini-cli

# 5. Install Python dependencies globally
# Note: --break-system-packages is required for Debian 12 global installs
RUN python3 -m pip install --no-cache-dir --upgrade pip --break-system-packages && \
    python3 -m pip install --no-cache-dir \
        fastapi \
        uvicorn \
        requests \
        google-genai \
        google-antigravity \
        python-dotenv \
        --break-system-packages

# 6. Copy rootfs and application files
WORKDIR /opt/antigravity-agent
COPY . .

# 7. Setup standard Home Assistant S6 Overlay scripts
RUN if [ -d "rootfs" ]; then \
        cp -rv rootfs/* /; \
        # Fix line endings and make execution script executable
        find /etc/s6-overlay -type f -exec dos2unix {} \;; \
        find /etc/s6-overlay -name run -exec chmod +x {} \;; \
        find /etc/s6-overlay -name finish -exec chmod +x {} \;; \
    fi

# Build arguments
ARG BUILD_ARCH
ARG BUILD_DESCRIPTION
ARG BUILD_NAME
ARG BUILD_REF
ARG BUILD_REPOSITORY

# Labels
LABEL \
    io.hass.name="${BUILD_NAME}" \
    io.hass.description="${BUILD_DESCRIPTION}" \
    io.hass.arch="${BUILD_ARCH}" \
    io.hass.type="addon" \
    io.hass.version="${BUILD_VERSION}" \
    maintainer="FaserF"

LABEL \
    org.opencontainers.image.title="Antigravity Agent" \
    org.opencontainers.image.description="Home Assistant Antigravity Agent (autonomous coding agent with Gemini & Antigravity)" \
    org.opencontainers.image.vendor="FaserF's Home Assistant Apps" \
    org.opencontainers.image.authors="FaserF <https://github.com/FaserF>" \
    org.opencontainers.image.licenses="MIT" \
    org.opencontainers.image.url="https://github.com/FaserF/hassio-addons/tree/master/antigravity-agent" \
    org.opencontainers.image.source="https://github.com/FaserF/hassio-addons/tree/master/antigravity-agent" \
    org.opencontainers.image.documentation="https://github.com/FaserF/hassio-addons/blob/master/antigravity-agent/README.md" \
    org.opencontainers.image.created="${BUILD_DATE}"

# Healthcheck to verify the FastAPI API server is responding on port 8077
HEALTHCHECK --interval=10s --timeout=5s --start-period=5s --retries=2 \
    CMD curl --fail -s http://127.0.0.1:8077/health || exit 1
