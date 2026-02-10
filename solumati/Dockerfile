ARG BUILD_FROM=ghcr.io/home-assistant/amd64-base-python:3.14-alpine3.21
# hadolint ignore=DL3006
FROM ${BUILD_FROM}

# CR-Skip-PythonBaseCheck: Base image is declared in ARG
ARG BUILD_DATE="1970-01-01T00:00:00Z"

# Setup Environment
ENV LANG=C.UTF-8
ENV PIP_ROOT_USER_ACTION=ignore
ENV PIP_BREAK_SYSTEM_PACKAGES=1

# Install System Requirements
# hadolint ignore=DL3018

# Addon metadata (injected by CI)
ENV ADDON_VERSION="2.3.0"
ENV ADDON_NAME="Solumati"
ENV ADDON_SLUG="solumati"
ENV ADDON_UNSUPPORTED="false"

RUN \
    apk add --no-cache -u libssl3 libcrypto3 \
    nodejs \
    npm \
    postgresql \
    postgresql-dev \
    nginx \
    gcc \
    musl-dev \
    libffi-dev \
    curl

# Set shell for pipefail support
SHELL ["/bin/ash", "-o", "pipefail", "-c"]

# --- SOURCE CODE FETCH STAGE ---
# Download the specific release tarball
ARG SOLUMATI_VERSION="v2026.2.0a1"
ENV SOLUMATI_VERSION=${SOLUMATI_VERSION}
# renovate: datasource=github-releases depName=FaserF/Solumati
ARG SOLUMATI_SHA256="66a22a143d7e69fd9cb63c315c9e55deff3adfd78f8cf2c5cfe31763958db8d4"
WORKDIR /tmp
RUN mkdir src && \
    curl -L "https://github.com/FaserF/Solumati/archive/refs/tags/${SOLUMATI_VERSION}.tar.gz" -o solumati.tar.gz && \
    echo "${SOLUMATI_SHA256} solumati.tar.gz" | sha256sum -c - && \
    tar xzf solumati.tar.gz -C src --strip-components=1 && \
    rm solumati.tar.gz

# Copy patch
COPY patches/auth_bypass.patch /tmp/auth_bypass.patch

# Apply patch
RUN cd src && patch -p0 < /tmp/auth_bypass.patch

# --- FRONTEND BUILD STAGE ---
WORKDIR /tmp/frontend_build
# Copy package files from the cloned source
RUN cp /tmp/src/frontend/package.json . && \
    (cp /tmp/src/frontend/package-lock.json* . || true) && \
    npm install && \
    cp -r /tmp/src/frontend/. . && \
    if [ -f "vite.config.ts" ]; then \
        sed -i "s|defineConfig({|defineConfig({ base: './',|g" vite.config.ts; \
    else \
        sed -i "s|defineConfig({|defineConfig({ base: './',|g" vite.config.js; \
    fi && \
    sed -i "s|export const API_URL = .*|export const API_URL = './api';|g" src/config.js && \
    sed -i "s|const API_URL = .*|const API_URL = './api';|g" src/config.js && \
    npm run build

# --- BACKEND SETUP ---
WORKDIR /app/backend
# Copy backend requirements from cloned source
RUN cp /tmp/src/backend/requirements.txt . && \
    pip install --no-cache-dir -r requirements.txt

# Copy backend code from cloned source
RUN cp -r /tmp/src/backend/. .

# Move built frontend to a location Nginx can serve
RUN mkdir -p /app/frontend && \
    cp -r /tmp/frontend_build/dist/* /app/frontend/

# Setup Nginx
COPY nginx.conf /etc/nginx/http.d/default.conf

# Copy Run Script
COPY run.sh /run.sh
RUN chmod a+x /run.sh

# Healthcheck
HEALTHCHECK --interval=5m --timeout=3s --start-period=60s --retries=3 \
    CMD curl --fail http://127.0.0.1:80/ || exit 1

# Labels
LABEL org.opencontainers.image.title="Solumati"
LABEL org.opencontainers.image.description="The Anti-Swipe Revolution - Self-hosted dating platform focused on meaningful matches."
LABEL org.opencontainers.image.vendor="FaserF's Home Assistant Apps"
LABEL org.opencontainers.image.authors="FaserF <https://github.com/FaserF>"
LABEL org.opencontainers.image.licenses="MIT"
LABEL org.opencontainers.image.url="https://github.com/FaserF/Solumati"
LABEL org.opencontainers.image.source="https://github.com/FaserF/Solumati"
LABEL org.opencontainers.image.documentation="https://github.com/FaserF/hassio-addons/blob/master/solumati/README.md"
LABEL org.opencontainers.image.created="${BUILD_DATE}"

CMD [ "/run.sh" ]
