ARG BUILD_FROM=ghcr.io/hassio-addons/base:20.0.3

# Stage 1: Get Frontend Assets
# renovate: datasource=docker depName=ghcr.io/eidolf/er-startseite/frontend
FROM ghcr.io/eidolf/er-startseite/frontend:v2026.2.1 AS frontend

# Stage 2: Get Backend Assets
# renovate: datasource=docker depName=ghcr.io/eidolf/er-startseite/backend
FROM ghcr.io/eidolf/er-startseite/backend:v2026.2.1 AS backend

# Stage 3: Build Add-on
# hadolint ignore=DL3006
FROM ${BUILD_FROM}

# Set shell
SHELL ["/bin/bash", "-o", "pipefail", "-c"]

# Setup base system
# Setup base system

# hadolint ignore=DL3008,DL3013,DL3018,DL3042

# App metadata (injected by CI)
ENV APP_VERSION="1.3.2"
ENV APP_NAME="ER-Startseite (Dashboard)"
ENV APP_SLUG="er-dashboard"
ENV APP_UNSUPPORTED="false"

RUN \
    echo "http://dl-cdn.alpinelinux.org/alpine/v3.23/main" > /etc/apk/repositories \
    && echo "http://dl-cdn.alpinelinux.org/alpine/v3.23/community" >> /etc/apk/repositories \
    && apk add --no-cache musl musl-dev \
    && apk upgrade --no-cache --available \
    && apk add --no-cache libssl3 libcrypto3 \
        curl \
        nginx \
        openssl \
        postgresql \
        postgresql-contrib \
        postgresql-jit \
        python3 \
        py3-pip \
        py3-greenlet \
        su-exec \
    \
    && pip3 install --no-cache-dir --upgrade pip

# Copy Frontend
COPY --from=frontend /usr/share/nginx/html /app/dist

# Copy Backend (code only, not venv - it's incompatible with Alpine)
COPY --from=backend /app/app /app/app
COPY --from=backend /app/entrypoint.sh /app/entrypoint.sh
COPY --from=backend /app/pyproject.toml /app/pyproject.toml

# Install Python Dependencies for Backend
# Installing directly from the dependencies listed in pyproject.toml
# hadolint ignore=DL3013
RUN pip3 install --no-cache-dir --break-system-packages \
    fastapi==0.115.8 \
    "uvicorn[standard]==0.34.0" \
    httpx==0.28.1 \
    "pydantic[email]==2.10.6" \
    pydantic-settings==2.7.1 \
    sqlalchemy==2.0.37 \
    alembic==1.14.1 \
    asyncpg==0.30.0 \
    python-multipart==0.0.20 \
    "python-jose[cryptography]==3.3.0" \
    "passlib[bcrypt]==1.7.4" \
    structlog==25.1.0

# Copy root filesystem
COPY rootfs /

# Fix S6 Overlay line endings and force correct type definitions
# We use sed -i to safely strip \r from all files
RUN find /etc/s6-overlay/s6-rc.d -type f -exec sed -i 's/\r$//' {} \; && \
    if [ -d /etc/services.d ]; then find /etc/services.d -type f -exec sed -i 's/\r$//' {} \;; fi && \
    echo "oneshot" > /etc/s6-overlay/s6-rc.d/init-secrets/type && \
    echo "oneshot" > /etc/s6-overlay/s6-rc.d/init-postgres/type && \
    echo "longrun" > /etc/s6-overlay/s6-rc.d/svc-postgres/type && \
    echo "oneshot" > /etc/s6-overlay/s6-rc.d/init-backend/type && \
    echo "longrun" > /etc/s6-overlay/s6-rc.d/svc-backend/type && \
    echo "longrun" > /etc/s6-overlay/s6-rc.d/svc-nginx/type

# Fix permissions
# hadolint ignore=DL3059
RUN chmod a+x /etc/s6-overlay/s6-rc.d/*/run 2>/dev/null; \
    chmod a+x /etc/s6-overlay/s6-rc.d/*/up 2>/dev/null; \
    chmod a+x /etc/s6-overlay/s6-rc.d/*/finish 2>/dev/null; \
    true

# Build arguments
ARG BUILD_ARCH
ARG BUILD_DATE
ARG BUILD_DESCRIPTION
ARG BUILD_NAME
ARG BUILD_REF
ARG BUILD_REPOSITORY
ARG BUILD_VERSION

# Labels
LABEL \
    io.hass.name="${BUILD_NAME}" \
    io.hass.description="${BUILD_DESCRIPTION}" \
    io.hass.arch="${BUILD_ARCH}" \
    io.hass.type="addon" \
    io.hass.version="${BUILD_VERSION}" \
    maintainer="FaserF <fabi.seitz@hotmail.de>" \
    org.opencontainers.image.title="${BUILD_NAME}" \
    org.opencontainers.image.description="${BUILD_DESCRIPTION}" \
    org.opencontainers.image.vendor="FaserF's Home Assistant Apps" \
    org.opencontainers.image.authors="FaserF <fabi.seitz@hotmail.de>" \
    org.opencontainers.image.licenses="MIT" \
    org.opencontainers.image.url="https://github.com/FaserF/hassio-addons" \
    org.opencontainers.image.source="https://github.com/${BUILD_REPOSITORY}" \
    org.opencontainers.image.documentation="https://github.com/${BUILD_REPOSITORY}/blob/main/README.md" \
    org.opencontainers.image.created="${BUILD_DATE}" \
    org.opencontainers.image.revision="${BUILD_REF}" \
    org.opencontainers.image.version="${BUILD_VERSION}"

# Service configuration
HEALTHCHECK \
    --interval=1m \
    --timeout=10s \
    --retries=3 \
    --start-period=5m \
    CMD /usr/bin/curl --fail http://127.0.0.1:8099 || exit 1
