ARG BUILD_FROM
FROM ${BUILD_FROM}
ENV PIP_BREAK_SYSTEM_PACKAGES=1

# Install necessary packages and prepare environment
# hadolint ignore=DL3018,DL3013,DL3042
ARG BT_MQTT_VERSION=1.7.1
RUN mkdir /application && \
    apk add --no-cache tzdata bluez bluez-libs sudo bluez-deprecated && \
    apk add --no-cache --virtual build-dependencies git bluez-dev musl-dev make gcc glib-dev && \
    apk add --no-cache --update wget unzip && \
    wget "https://github.com/zewelor/bt-mqtt-gateway/archive/refs/tags/${BT_MQTT_VERSION}.zip" && \
    unzip -d /tmp/ "${BT_MQTT_VERSION}.zip" && rm -r "${BT_MQTT_VERSION}.zip" && cp -r "/tmp/bt-mqtt-gateway-${BT_MQTT_VERSION}/"* /application && \
    chmod +x /application/gateway.py && \
    cat <<EOF > /application/logger.yaml
version: 1
disable_existing_loggers: True

formatters:
  default:
    format: '%(asctime)s %(message)s'
    datefmt: '%X'
  minimal:
    format: '%(message)s'
  debug:
    format: '%(asctime)s %(levelname)s %(name)s %(filename)s:%(lineno)d:%(funcName)s - %(message)s'

handlers:
  console:
    class: logging.StreamHandler
    formatter: default
    stream: ext://sys.stdout
  dummy_debug:
    class: logging.NullHandler
    formatter: debug

loggers:
  bt-mqtt-gw:
    level: INFO
  dummy_debug:
    handlers: [dummy_debug]

root:
  handlers: [console]
EOF

# PIP setup - install requirements only (no runtime execution during build)
RUN python3 -m venv /application/venv && \
    /bin/sh -c ". /application/venv/bin/activate && pip install --no-cache-dir -r /application/requirements.txt" && \
    apk del build-dependencies wget unzip

# Copy start script and make it executable
COPY start.sh /
RUN chmod a+x /start.sh

CMD [ "/start.sh" ]

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




