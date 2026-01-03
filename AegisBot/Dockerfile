ARG BUILD_FROM=ghcr.io/hassio-addons/base:19.0.0
# hadolint ignore=DL3006
FROM ${BUILD_FROM}
ARG BUILD_DATE="1970-01-01T00:00:00Z"

# Set shell
SHELL ["/bin/bash", "-o", "pipefail", "-c"]

# Setup Environment
ENV LANG=C.UTF-8
ENV PIP_ROOT_USER_ACTION=ignore
ENV PIP_BREAK_SYSTEM_PACKAGES=1
ENV PYTHONUNBUFFERED=1

# Install System Requirements including Node.js
# hadolint ignore=DL3018,DL3017





# Addon metadata (injected by CI)
ENV ADDON_VERSION="0.2.0"
ENV ADDON_NAME="AegisBot"
ENV ADDON_SLUG="aegisbot"
ENV ADDON_UNSUPPORTED="false"

RUN \
    apk upgrade --no-cache && \
    apk add --no-cache \
    musl \
    nginx \
    gcc \
    musl-dev \
    libffi-dev \
    curl \
    postgresql-client \
    xz \
    python3 \
    nodejs \
    npm && \
    # Verify Node.js version
    node --version && \
    npm --version

# Try to download and build during Docker build if repo is public.
# If this fails (e.g. private repo), we continue and let run.sh handle it.
# CR-Skip-TarballIntegrity: Dynamic tarball from GitHub API, checksum not applicable

ARG AEGISBOT_VERSION="latest"
ENV AEGISBOT_VERSION=${AEGISBOT_VERSION}

WORKDIR /tmp/build
# hadolint ignore=DL3003,DL3018
RUN \
    echo "Attempting to fetch AegisBot version: ${AEGISBOT_VERSION}" && \
    # 1. Resolve Version URL
    DOWNLOAD_URL="" && \
    if [ "${AEGISBOT_VERSION}" = "latest" ]; then \
        # Try to find latest tag via API (with Accept header for better rate limits)
        TAG_NAME=$(curl -s -H "Accept: application/vnd.github.v3+json" https://api.github.com/repos/FaserF/AegisBot/releases/latest | grep '"tag_name":' | sed -E 's/.*"tag_name": "([^"]+)".*/\1/'); \
        if [ -n "$TAG_NAME" ]; then \
            echo "Resolved latest version to: ${TAG_NAME}"; \
            DOWNLOAD_URL="https://api.github.com/repos/FaserF/AegisBot/tarball/${TAG_NAME}"; \
        else \
            echo "Could not resolve latest version tag. Skipping build stage."; \
        fi; \
    else \
        DOWNLOAD_URL="https://api.github.com/repos/FaserF/AegisBot/tarball/${AEGISBOT_VERSION}"; \
    fi && \
    # 2. Try Download & Build (If URL found)
    if [ -n "$DOWNLOAD_URL" ]; then \
        echo "Attempting download from: ${DOWNLOAD_URL}"; \
        if curl -L -f -o source.tar.gz "$DOWNLOAD_URL"; then \
            echo "✅ Download successful (Public Repo). Building image..."; \
            \
            # Extract \
            tar -xzf source.tar.gz --strip-components=1 && \
            \
            # Setup Backend \
            mkdir -p /app/backend && \
            cp -r backend/* /app/backend/ && \
            if [ -f "/app/backend/requirements.txt" ]; then \
                pip3 install --no-cache-dir -r /app/backend/requirements.txt; \
            fi && \
            \
            # Setup Frontend \
            mkdir -p /app/frontend && \
            cd frontend && \
            npm install && \
            sed -i "s|defineConfig({|defineConfig({ base: './',|g" vite.config.ts && \
            sed -i "s|const API_BASE = '.*'|const API_BASE = './api/v1'|g" src/api/client.ts && \
            # Verify sed modifications were applied
            grep -q "base: './" vite.config.ts || { echo "Failed to patch vite.config.ts"; exit 1; } && \
            grep -q "API_BASE = './api/v1'" src/api/client.ts || { echo "Failed to patch client.ts"; exit 1; } && \
            npm run build && \
            cp -r dist/* /app/frontend/ && \
            \
            # Cleanup \
            cd / && \
            rm -rf /tmp/build && \
            echo "✅ Build complete. Image is self-contained."; \
        else \
            echo "⚠️ Download failed (likely Private Repository or Invalid Version)."; \
            echo "Skipping build stage. 'run.sh' will handle download with Token."; \
            # Ensure directories are clean/empty so run.sh detects missing code \
            rm -rf /app/backend/* /app/frontend/*; \
            rm -f /tmp/build/source.tar.gz; \
        fi; \
    fi

# Create app directories (if not created by build step)
WORKDIR /app
RUN \
    mkdir -p /app/backend && \
    mkdir -p /app/frontend

# Setup Nginx
COPY nginx.conf /etc/nginx/http.d/default.conf

# Copy Run Script
COPY run.sh /run.sh
RUN chmod a+x /run.sh

# Health check - faster detection with startup grace period
HEALTHCHECK --interval=30s --timeout=3s --start-period=60s --retries=3 \
    CMD curl --fail http://127.0.0.1:8000/api/health || exit 1

CMD [ "/run.sh" ]

# Labels
LABEL org.opencontainers.image.title="AegisBot"
LABEL org.opencontainers.image.description="Production-ready Telegram Moderation Bot with AI-driven FAQ and Security Features"
LABEL org.opencontainers.image.vendor="FaserF's Home Assistant Add-ons"
LABEL org.opencontainers.image.authors="FaserF <https://github.com/FaserF>"
LABEL org.opencontainers.image.licenses="MIT"
LABEL org.opencontainers.image.url="https://github.com/FaserF/AegisBot"
LABEL org.opencontainers.image.source="https://github.com/FaserF/AegisBot"
LABEL org.opencontainers.image.documentation="https://github.com/FaserF/AegisBot#readme"
LABEL org.opencontainers.image.created="${BUILD_DATE}"
