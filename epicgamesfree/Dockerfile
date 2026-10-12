ARG BUILD_FROM=ghcr.io/hassio-addons/base-python:19.1.0
FROM ${BUILD_FROM}

# Install requirements for Python script
RUN \
  apk add --no-cache \
    nginx \
  && pip install --no-cache-dir \
    aiohttp \
    croniter \
    epicstore-api \
    requests

# Copy root filesystem
COPY rootfs /

# Make scripts executable
RUN chmod a+x /run.sh /usr/bin/epic_server.py

CMD [ "/run.sh" ]

# Labels
LABEL org.opencontainers.image.title="Epic Games Freebies Claimer"
LABEL org.opencontainers.image.description="Automatically login, persist session in /data, and claim promotional free games from Epic Games Store"
LABEL org.opencontainers.image.vendor="FaserF's Home Assistant Apps"
LABEL org.opencontainers.image.authors="FaserF <https://github.com/FaserF>"
LABEL org.opencontainers.image.licenses="MIT"
LABEL org.opencontainers.image.url="https://github.com/FaserF/hassio-addons"
LABEL org.opencontainers.image.source="https://github.com/FaserF/hassio-addons"
LABEL org.opencontainers.image.documentation="https://github.com/FaserF/hassio-addons/blob/master/epicgamesfree/README.md"
LABEL org.opencontainers.image.created="${BUILD_DATE}"
