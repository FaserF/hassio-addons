ARG BUILD_FROM=ghcr.io/hassio-addons/base:19.0.0
# hadolint ignore=DL3006
FROM ${BUILD_FROM}
# Create virtual environment and add to PATH
ARG BUILD_DATE="1970-01-01T00:00:00Z"
ENV VIRTUAL_ENV=/usr/local/venv
RUN python3 -m venv $VIRTUAL_ENV
ENV PATH="$VIRTUAL_ENV/bin:$PATH"

# Pin sslpsk to specific commit for reproducible builds
# hadolint ignore=DL3018,DL3013,DL3042
RUN apk add --no-cache bash git iw dnsmasq hostapd screen curl mosquitto haveged net-tools openssl openssl-dev gcc musl-dev linux-headers sudo coreutils grep iproute2 && \
    pip install --upgrade paho-mqtt==1.6.1 tornado==6.4 git+https://github.com/drbild/sslpsk.git@e944d1cdd2e04c4bca4fd5f8b1022c92fd7db534 pycryptodomex==3.20.0 && \
    git clone --depth 1 https://github.com/ct-Open-Source/tuya-convert /usr/local/tuya-convert && \
    sed -i 's|ls -m|ls|' /usr/local/tuya-convert/scripts/setup_checks.sh
WORKDIR "/usr/local/tuya-convert"

# Copy data for add-on
COPY start.sh /
RUN chmod a+x /start.sh
CMD [ "/start.sh" ]

# Health check - verify main process is running
HEALTHCHECK CMD pgrep -f start.sh >/dev/null || exit 1

# Labels
LABEL org.opencontainers.image.title="tuya-convert BETA"
LABEL org.opencontainers.image.description="Tuya Convert - Flash Tuya devices with open Source software (Beta/Deprecated) (Unsupported)"
LABEL org.opencontainers.image.vendor="FaserF's Home Assistant Add-ons"
LABEL org.opencontainers.image.authors="FaserF <https://github.com/FaserF>"
LABEL org.opencontainers.image.licenses="MIT"
LABEL org.opencontainers.image.url="https://github.com/FaserF/hassio-addons/tree/master/.unsupported/tuya-convert"
LABEL org.opencontainers.image.source="https://github.com/FaserF/hassio-addons/tree/master/.unsupported/tuya-convert"
LABEL org.opencontainers.image.documentation="https://github.com/FaserF/hassio-addons/blob/master/.unsupported/tuya-convert/README.md"
LABEL org.opencontainers.image.created="${BUILD_DATE}"
