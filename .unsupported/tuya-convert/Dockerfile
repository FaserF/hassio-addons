ARG BUILD_FROM=ghcr.io/hassio-addons/base:19.0.0
# hadolint ignore=DL3006
FROM ${BUILD_FROM}
# Create virtual environment and add to PATH
ARG BUILD_DATE="unknown"
# CR-Skip-PythonBaseCheck
ENV VIRTUAL_ENV=/usr/local/venv
ENV PATH="$VIRTUAL_ENV/bin:$PATH"

# Pin sslpsk to specific commit for reproducible builds
# hadolint ignore=DL3018,DL3013,DL3042
RUN apk add --no-cache python3 python3-dev bash git iw dnsmasq hostapd screen curl mosquitto haveged net-tools openssl openssl-dev gcc musl-dev linux-headers sudo coreutils grep iproute2 && \
    python3 -m venv $VIRTUAL_ENV && \
    pip install --no-cache-dir --upgrade paho-mqtt==1.6.1 tornado==6.4.2 git+https://github.com/drbild/sslpsk.git@e944d86eb1c41bf10250586c16ed6b1bd933ed2b pycryptodomex==3.20.0 && \
    git clone https://github.com/ct-Open-Source/tuya-convert /usr/local/tuya-convert && \
    cd /usr/local/tuya-convert && \
    git checkout b202d18b81f5c93d06188f02c02ec65be6efd7ec && \
    sed -i 's|ls -m|ls|' /usr/local/tuya-convert/scripts/setup_checks.sh
WORKDIR "/usr/local/tuya-convert"

# Copy data for add-on
COPY start.sh /
RUN chmod a+x /start.sh
CMD [ "/start.sh" ]

# Health check - verify addon is still running (start.sh is a one-time operation, so we check the main process)
# Note: This addon runs a one-time flash operation; the healthcheck verifies the container is alive
HEALTHCHECK --interval=300s --timeout=3s \
    CMD pgrep -x "bash" >/dev/null || pgrep -f "start.sh" >/dev/null || exit 1

# Labels
LABEL \
    org.opencontainers.image.title="tuya-convert BETA" \
    org.opencontainers.image.description="Tuya Convert - Flash Tuya devices with open Source software (Beta/Deprecated) (Unsupported)" \
    org.opencontainers.image.vendor="FaserF's Home Assistant Add-ons" \
    org.opencontainers.image.authors="FaserF <https://github.com/FaserF>" \
    org.opencontainers.image.licenses="MIT" \
    org.opencontainers.image.url="https://github.com/FaserF/hassio-addons/tree/master/.unsupported/tuya-convert" \
    org.opencontainers.image.source="https://github.com/FaserF/hassio-addons/tree/master/.unsupported/tuya-convert" \
    org.opencontainers.image.documentation="https://github.com/FaserF/hassio-addons/blob/master/.unsupported/tuya-convert/README.md" \
    org.opencontainers.image.created="${BUILD_DATE}"
