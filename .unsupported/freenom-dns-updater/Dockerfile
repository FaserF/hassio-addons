ARG BUILD_FROM=ghcr.io/hassio-addons/base:20.0.3
# hadolint ignore=DL3006
FROM ${BUILD_FROM}
ENV PIP_BREAK_SYSTEM_PACKAGES=1
ARG BUILD_DATE="1970-01-01T00:00:00Z"
# CR-Skip-PythonBaseCheck

# Create directory for FDU
#RUN mkdir -p '/opt/freenom_dns_updater'
#COPY . /opt/freenom_dns_updater/
#WORKDIR /opt/freenom_dns_updater
# hadolint ignore=DL3018,DL3013,DL3042

RUN \
    echo "http://dl-cdn.alpinelinux.org/alpine/v3.23/main" > /etc/apk/repositories \
    && echo "http://dl-cdn.alpinelinux.org/alpine/v3.23/community" >> /etc/apk/repositories \
    && apk upgrade --no-cache --available \
    && apk add --no-cache \
    curl \
    mosquitto \
    openssl \
    python3 \
    py3-pip \
    bash \
    iw \
    dnsmasq \
    hostapd \
    screen \
    wireless-tools \
    iproute2 \
    sudo \
    && pip3 install --no-cache-dir --break-system-packages paho-mqtt==2.1.0 tornado==6.5.0 freenom-dns-updater
#RUN rm -rf /opt/freenom_dns_updater

# Copy data for add-on
#ENTRYPOINT [ "fdu" ]
#CMD [ "process", "-i", "-c", "-r", "-t", "3600", "/etc/freenom.yml" ]
COPY run.sh /
RUN chmod a+x /run.sh
CMD [ "/run.sh" ]

# Health check - verify main process is running (use exact path)
HEALTHCHECK --interval=300s --timeout=10s --start-period=30s --retries=3 \
    CMD pgrep -f "^/bin/bash /run.sh" >/dev/null || pgrep -x "bashio" >/dev/null || exit 1

# Labels
LABEL org.opencontainers.image.title="Freenom-dns-updater"
LABEL org.opencontainers.image.description="Freenom Registrar Domain Management - update dns records, Manage (add/update/remove) a domain's dns record, auto renew domains and more. (Unsupported)"
LABEL org.opencontainers.image.vendor="FaserF's Home Assistant Apps"
LABEL org.opencontainers.image.authors="FaserF <https://github.com/FaserF>"
LABEL org.opencontainers.image.licenses="MIT"
LABEL org.opencontainers.image.url="https://github.com/FaserF/hassio-addons/tree/master/.unsupported/freenom-dns-updater"
LABEL org.opencontainers.image.source="https://github.com/FaserF/hassio-addons/tree/master/.unsupported/freenom-dns-updater"
LABEL org.opencontainers.image.documentation="https://github.com/FaserF/hassio-addons/blob/master/.unsupported/freenom-dns-updater/README.md"
LABEL org.opencontainers.image.created="${BUILD_DATE}"
