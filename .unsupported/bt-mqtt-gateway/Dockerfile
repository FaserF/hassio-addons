ARG BUILD_FROM=ghcr.io/hassio-addons/base:latest
# hadolint ignore=DL3006
FROM ${BUILD_FROM}


# Install necessary packages and prepare environment
# hadolint ignore=DL3018,DL3013,DL3042,DL3006
# Set version (pinned for reproducibility)
ARG BT_MQTT_VERSION=827e251
ARG BUILD_DATE
# hadolint ignore=DL3018
RUN mkdir /application && \
    apk add --no-cache tzdata bluez bluez-libs sudo bluez-deprecated && \
    apk add --no-cache --virtual build-dependencies git bluez-dev musl-dev make gcc glib-dev && \
    apk add --no-cache --update wget unzip && \
    wget -nv "https://github.com/zewelor/bt-mqtt-gateway/archive/${BT_MQTT_VERSION}.tar.gz" -O "${BT_MQTT_VERSION}.tar.gz" && \
    tar xzf "${BT_MQTT_VERSION}.tar.gz" -C /tmp/ && \
    rm "${BT_MQTT_VERSION}.tar.gz" && \
    mv /tmp/bt-mqtt-gateway-*/* /application && \
    chmod +x /application/gateway.py

COPY logger.yaml /application/logger.yaml

# PIP setup - install requirements only (no runtime execution during build)
RUN python3 -m venv /application/venv && \
    /bin/sh -c ". /application/venv/bin/activate && pip install --no-cache-dir -r /application/requirements.txt" && \
    apk del build-dependencies wget unzip

# Copy start script and make it executable
COPY start.sh /
RUN chmod a+x /start.sh

CMD [ "/start.sh" ]

# Healthcheck
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD pgrep -f "gateway.py" || exit 1

# Labels
LABEL org.opencontainers.image.title="bt-mqtt-gateway"
LABEL org.opencontainers.image.description="Bluetooth MQTT Gateway Server (Unsupported)"
LABEL org.opencontainers.image.vendor="FaserF's Home Assistant Add-ons"
LABEL org.opencontainers.image.authors="FaserF <https://github.com/FaserF>"
LABEL org.opencontainers.image.licenses="MIT"
LABEL org.opencontainers.image.url="https://github.com/FaserF/hassio-addons/tree/master/.unsupported/bt-mqtt-gateway"
LABEL org.opencontainers.image.source="https://github.com/FaserF/hassio-addons/tree/master/.unsupported/bt-mqtt-gateway"
LABEL org.opencontainers.image.documentation="https://github.com/FaserF/hassio-addons/blob/master/.unsupported/bt-mqtt-gateway/README.md"
LABEL org.opencontainers.image.created="${BUILD_DATE}"
