ARG BUILD_FROM
# hadolint ignore=DL3006
FROM ${BUILD_FROM}
ARG BUILD_DATE

ARG BUILD_DATE

# Setup Environment
ENV LANG C.UTF-8
ENV PIP_ROOT_USER_ACTION=ignore
ENV PIP_BREAK_SYSTEM_PACKAGES=1

# Install System Requirements
# hadolint ignore=DL3018
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

# --- SOURCE CODE FETCH STAGE ---
# Download the specific release tarball
ARG SOLUMATI_VERSION="v2025.12.4b0"
WORKDIR /tmp
RUN curl -L "https://github.com/FaserF/Solumati/archive/refs/tags/${SOLUMATI_VERSION}.tar.gz" -o solumati.tar.gz && \
    tar -xzf solumati.tar.gz && \
    mv Solumati-* src && \
    rm solumati.tar.gz

# --- FRONTEND BUILD STAGE ---
WORKDIR /tmp/frontend_build
# Copy package files from the cloned source
ARG BUILD_DATE
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
# Copy backend requirements from cloned source
RUN cp /tmp/src/backend/requirements.txt . && \
    pip install --no-cache-dir -r requirements.txt

# Copy backend code from cloned source
ARG BUILD_DATE
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
HEALTHCHECK \
    CMD curl --fail http://127.0.0.1:80/ || exit 1

CMD [ "/run.sh" ]

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
