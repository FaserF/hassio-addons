ARG BUILD_FROM=ghcr.io/hassio-addons/base-python:17.0.4
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
