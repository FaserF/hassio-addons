ARG BUILD_FROM
# hadolint ignore=DL3006
FROM ${BUILD_FROM}
ARG BUILD_DATE

# Setup Environment
ENV LANG=C.UTF-8
ENV PIP_ROOT_USER_ACTION=ignore
ENV PIP_BREAK_SYSTEM_PACKAGES=1
ENV PYTHONUNBUFFERED=1

# Install System Requirements
# hadolint ignore=DL3018,DL3017
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
    xz && \
    # Install Node.js 22.12.0 (LTS) to meet package requirements (>=20.19.0 || >=22.12.0 || >=24.0.0)
    # Detect architecture and install appropriate Node.js binary
    ARCH=$(uname -m) && \
    NODE_VERSION="v22.12.0" && \
    case "$ARCH" in \
        x86_64) \
            NODE_URL="https://unofficial-builds.nodejs.org/download/release/${NODE_VERSION}/node-${NODE_VERSION}-linux-x64-musl.tar.xz" \
            ;; \
        aarch64) \
            NODE_URL="https://unofficial-builds.nodejs.org/download/release/${NODE_VERSION}/node-${NODE_VERSION}-linux-arm64-musl.tar.xz" \
            ;; \
        armv7l|armv6l) \
            NODE_URL="https://unofficial-builds.nodejs.org/download/release/${NODE_VERSION}/node-${NODE_VERSION}-linux-armv7l.tar.xz" \
            ;; \
        *) \
            echo "Unsupported architecture: $ARCH" && exit 1 \
            ;; \
    esac && \
    echo "Installing Node.js ${NODE_VERSION} for architecture ${ARCH}..." && \
    curl -fsSL "$NODE_URL" -o /tmp/node.tar.xz && \
    tar -xJf /tmp/node.tar.xz -C /tmp && \
    NODE_DIR=$(ls -d /tmp/node-${NODE_VERSION}-linux-* 2>/dev/null | head -1) && \
    if [ -z "$NODE_DIR" ]; then \
        echo "Failed to extract Node.js" && exit 1; \
    fi && \
    mv "$NODE_DIR" /opt/nodejs && \
    ln -sf /opt/nodejs/bin/node /usr/local/bin/node && \
    ln -sf /opt/nodejs/bin/npm /usr/local/bin/npm && \
    ln -sf /opt/nodejs/bin/npx /usr/local/bin/npx && \
    rm -rf /tmp/node.tar.xz /tmp/node-${NODE_VERSION}-linux-* && \
    # Verify Node.js version
    node --version && \
    npm --version

# Try to download and build during Docker build if repo is public.
# If this fails (e.g. private repo), we continue and let run.sh handle it.

ARG AEGISBOT_VERSION="latest"

WORKDIR /tmp/build
# hadolint ignore=DL3003,DL3018
RUN \
    echo "Attempting to fetch AegisBot version: ${AEGISBOT_VERSION}" && \
    # 1. Resolve Version URL
    DOWNLOAD_URL="" && \
    if [ "${AEGISBOT_VERSION}" = "latest" ]; then \
        # Try to find latest tag via API
        TAG_NAME=$(curl -s https://api.github.com/repos/FaserF/AegisBot/releases/latest | grep '"tag_name":' | sed -E 's/.*"tag_name": "([^"]+)".*/\1/'); \
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

# Health check
HEALTHCHECK \
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
LABEL org.opencontainers.image.documentation="https://github.com/FaserF/AegisBot/blob/master/AegisBot/README.md"
LABEL org.opencontainers.image.created="${BUILD_DATE}"
