ARG BUILD_FROM
FROM ${BUILD_FROM}

# Install necessary packages and prepare environment
# hadolint ignore=DL3018,DL3013,DL3042
RUN mkdir /application && \
    apk add --no-cache tzdata bluez bluez-libs sudo bluez-deprecated && \
    apk add --no-cache --virtual build-dependencies git bluez-dev musl-dev make gcc glib-dev && \
    apk add --no-cache --update wget unzip py3-pip && \
    wget https://github.com/zewelor/bt-mqtt-gateway/archive/refs/heads/master.zip && \
    unzip -d /tmp/ master.zip && rm -r master.zip && cp -r /tmp/bt-mqtt-gateway-master/* /application && \
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

# PIP setup separate to avoid breaking heredoc context in same RUN if not careful, but can be merged if carefully handling EOF.
# Keeping separate for clarity or merging:
# Merging continues...

RUN python3 -m venv /application/venv && \
    /bin/sh -c "source /application/venv/bin/activate && pip install --no-cache-dir -r /application/requirements.txt" && \
    # Debug checks
    cat /application/gateway.py && \
    /bin/sh -c "source /application/venv/bin/activate && python /application/gateway.py -r all > /application/gateway_output.log 2>&1 || (cat /application/gateway_output.log && exit 1)" && \
    /bin/sh -c "source /application/venv/bin/activate && pip install --no-cache-dir \$(/application/gateway.py -r all)" && \
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
LABEL org.opencontainers.image.url="https://github.com/FaserF/hassio-addons/tree/master/bt-mqtt-gateway"
LABEL org.opencontainers.image.source="https://github.com/FaserF/hassio-addons/tree/master/bt-mqtt-gateway"
LABEL org.opencontainers.image.documentation="https://github.com/FaserF/hassio-addons/tree/master/bt-mqtt-gateway/blob/master/bt-mqtt-gateway/README.md"
LABEL org.opencontainers.image.created="2025-12-24"
