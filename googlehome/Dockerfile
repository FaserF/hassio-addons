ARG BUILD_FROM=ghcr.io/hassio-addons/base:21.0.3
# hadolint ignore=DL3006
FROM $BUILD_FROM

SHELL ["/bin/bash", "-o", "pipefail", "-c"]

ENV APP_VERSION="0.1.0"
ENV APP_NAME="Google Home Token Hub"
ENV APP_SLUG="googlehome"
ENV APP_UNSUPPORTED="false"

# 1. Install Alpine packages
# hadolint ignore=DL3018
RUN apk add --no-cache python3 py3-pip chromium ttf-freefont ca-certificates curl jq "dos2unix~=7.5"

# 2. Set workdir
WORKDIR /opt/googlehome

# 3. Copy project files
COPY . .

# 4. Install Python dependencies
RUN python3 -m pip install --no-cache-dir --break-system-packages fastapi uvicorn jinja2 gpsoauth glocaltokens aiohttp websockets

# 5. Move rootfs to root & fix line endings
RUN if [ -d "rootfs" ]; then cp -rv rootfs/* /; find /etc/s6-overlay -type f -exec dos2unix {} \;; find /etc/s6-overlay -name run -exec chmod +x {} \;; find /etc/s6-overlay -name finish -exec chmod +x {} \;; find /usr/lib/bashio -type f -exec dos2unix {} \; 2>/dev/null || true; fi

EXPOSE 8195

# Labels
LABEL org.opencontainers.image.title="Google Home Token Hub"
LABEL org.opencontainers.image.description="Google Home Master Token Generator & Ingress Authentication Hub for Home Assistant."
LABEL org.opencontainers.image.vendor="FaserF's Home Assistant Apps"
LABEL org.opencontainers.image.authors="FaserF <https://github.com/FaserF>"
LABEL org.opencontainers.image.licenses="MIT"
LABEL org.opencontainers.image.url="https://github.com/FaserF/ha-googlehome"
LABEL org.opencontainers.image.source="https://github.com/FaserF/ha-googlehome"
LABEL org.opencontainers.image.documentation="https://github.com/FaserF/ha-googlehome/blob/master/googlehome/README.md"
LABEL org.opencontainers.image.created="${BUILD_DATE}"
