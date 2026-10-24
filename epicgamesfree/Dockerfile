ARG BUILD_FROM=ghcr.io/hassio-addons/base-python:20.0.0
FROM ${BUILD_FROM}

# Install requirements for Python script
RUN \
  apk add --no-cache \
    nginx \
  && apk add --no-cache --virtual .build-deps \
    build-base \
    libffi-dev \
    python3-dev \
  && pip install --no-cache-dir \
    aiohttp \
    croniter \
    epicstore-api \
    requests \
  && apk del .build-deps

# Copy root filesystem
COPY rootfs /

# Make scripts executable
RUN chmod a+x /run.sh /usr/bin/epic_server.py

CMD [ "/run.sh" ]

# Labels
ARG BUILD_DATE
LABEL org.opencontainers.image.title="Epic Games Freebies Claimer"
LABEL org.opencontainers.image.description="Automatically login, persist session in /data, and claim promotional free games from Epic Games Store"
LABEL org.opencontainers.image.vendor="FaserF's Home Assistant Apps"
LABEL org.opencontainers.image.authors="FaserF <https://github.com/FaserF>"
LABEL org.opencontainers.image.licenses="MIT"
LABEL org.opencontainers.image.url="https://github.com/FaserF/hassio-addons"
LABEL org.opencontainers.image.source="https://github.com/FaserF/hassio-addons"
LABEL org.opencontainers.image.documentation="https://github.com/FaserF/hassio-addons/blob/master/epicgamesfree/README.md"
LABEL org.opencontainers.image.created="${BUILD_DATE}"
