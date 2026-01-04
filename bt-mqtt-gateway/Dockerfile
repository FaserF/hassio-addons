ARG BUILD_FROM=ghcr.io/hassio-addons/base:19.0.0
# hadolint ignore=DL3006
FROM ${BUILD_FROM}


# Install necessary packages and prepare environment
# hadolint ignore=DL3018,DL3013,DL3042,DL3006
# Set version (pinned for reproducibility)
ARG BT_MQTT_VERSION=827e251
# renovate: datasource=git-refs depName=zewelor/bt-mqtt-gateway
ARG BT_MQTT_SHA256="771a144eb156da03fb930977bd6f231ba0e7e51b29b613d3c05200a3ae0f98d8"
ARG BUILD_DATE="1970-01-01T00:00:00Z"
# CR-Skip-PythonBaseCheck: Uses venv with base image

# Set shell for pipefail support
SHELL ["/bin/ash", "-o", "pipefail", "-c"]

# hadolint ignore=DL3018



# Addon metadata (injected by CI)
ENV ADDON_VERSION="3.0.0"
ENV ADDON_NAME="bt-mqtt-gateway (Unsupported)"
ENV ADDON_SLUG="bt-mqtt-gateway"
ENV ADDON_UNSUPPORTED="true"

RUN mkdir /application && \
    apk add --no-cache tzdata bluez bluez-libs sudo bluez-deprecated python3 && \
    apk add --no-cache --virtual build-dependencies git bluez-dev musl-dev make gcc glib-dev python3-dev && \
    apk add --no-cache --update wget && \
    wget -nv "https://github.com/zewelor/bt-mqtt-gateway/archive/${BT_MQTT_VERSION}.tar.gz" -O "${BT_MQTT_VERSION}.tar.gz" && \
    echo "${BT_MQTT_SHA256}  ${BT_MQTT_VERSION}.tar.gz" | sha256sum -c - && \
    tar xzf "${BT_MQTT_VERSION}.tar.gz" -C /tmp/ && \
    rm "${BT_MQTT_VERSION}.tar.gz" && \
    mv /tmp/bt-mqtt-gateway-*/* /application && \
    chmod +x /application/gateway.py

COPY logger.yaml /application/logger.yaml

# PIP setup - install requirements and common optional dependencies
# Install optional dependencies before removing build-dependencies (needed for pyserial compilation)
RUN python3 -m venv /application/venv && \
    /bin/sh -c ". /application/venv/bin/activate && pip install --no-cache-dir setuptools pytz -r /application/requirements.txt" && \
    /bin/sh -c ". /application/venv/bin/activate && pip install --no-cache-dir python-eq3bt==0.1.12 pyserial" && \
    apk del build-dependencies wget

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
