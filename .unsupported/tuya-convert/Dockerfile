ARG BUILD_FROM
# hadolint ignore=DL3006
FROM ${BUILD_FROM}

# hadolint ignore=DL3018,DL3013,DL3042
RUN apk add --no-cache bash git iw dnsmasq hostapd screen curl py3-pip py3-wheel python3-dev mosquito haveged net-tools openssl openssl-dev gcc musl-dev linux-headers sudo coreutils grep iproute2 && \
    python3 -m pip install --upgrade paho-mqtt tornado git+https://github.com/drbild/sslpsk.git pycryptodomex && \
    git clone --depth 1 https://github.com/ct-Open-Source/tuya-convert /usr/local/tuya-convert && \
    sed -i 's|ls -m|ls|' /usr/local/tuya-convert/scripts/setup_checks.sh
WORKDIR "/usr/local/tuya-convert"

# Copy data for add-on
COPY start.sh /
RUN chmod a+x /start.sh
CMD [ "/start.sh" ]

# Labels
LABEL org.opencontainers.image.title="tuya-convert BETA"
LABEL org.opencontainers.image.description="Tuya Convert - Flash Tuya devices with open Source software (Beta/Deprecated) (Unsupported)"
LABEL org.opencontainers.image.vendor="FaserF's Home Assistant Add-ons"
LABEL org.opencontainers.image.authors="FaserF <https://github.com/FaserF>"
LABEL org.opencontainers.image.licenses="MIT"
LABEL org.opencontainers.image.url="https://github.com/FaserF/hassio-addons/tree/master/tuya-convert"
LABEL org.opencontainers.image.source="https://github.com/FaserF/hassio-addons/tree/master/tuya-convert"
LABEL org.opencontainers.image.documentation="https://github.com/FaserF/hassio-addons/tree/master/tuya-convert/blob/master/tuya-convert/README.md"
LABEL org.opencontainers.image.created="2025-12-24"
