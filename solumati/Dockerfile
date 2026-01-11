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
ENV ADDON_VERSION="2.1.3"
ENV ADDON_NAME="Solumati"
ENV ADDON_SLUG="solumati"
ENV ADDON_UNSUPPORTED="false"

RUN \
    apk add --no-cache \
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
ARG SOLUMATI_VERSION="v2025.12.4b0"
ENV SOLUMATI_VERSION=${SOLUMATI_VERSION}
# renovate: datasource=github-releases depName=FaserF/Solumati
ARG SOLUMATI_SHA256="fd5be5ca00e1f00a6205f15517f5fb3bad15ac7183e51ae5a8fdae2cab37e218"
WORKDIR /tmp
RUN mkdir src && \
    curl -L "https://github.com/FaserF/Solumati/archive/refs/tags/${SOLUMATI_VERSION}.tar.gz" -o solumati.tar.gz && \
    echo "${SOLUMATI_SHA256}  solumati.tar.gz" | sha256sum -c - && \
    tar xzf solumati.tar.gz -C src --strip-components=1 && \
    rm solumati.tar.gz

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
LABEL org.opencontainers.image.vendor="FaserF's Home Assistant Add-ons"
LABEL org.opencontainers.image.authors="FaserF <https://github.com/FaserF>"
LABEL org.opencontainers.image.licenses="MIT"
LABEL org.opencontainers.image.url="https://github.com/FaserF/Solumati"
LABEL org.opencontainers.image.source="https://github.com/FaserF/Solumati"
LABEL org.opencontainers.image.documentation="https://github.com/FaserF/hassio-addons/blob/master/solumati/README.md"
LABEL org.opencontainers.image.created="${BUILD_DATE}"

CMD [ "/run.sh" ]
