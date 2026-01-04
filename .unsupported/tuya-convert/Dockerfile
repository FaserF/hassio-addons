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

# Addon metadata (injected by CI)
ENV ADDON_VERSION="0.2.0"
ENV ADDON_NAME="tuya-convert BETA (Unsupported)"
ENV ADDON_SLUG="tuya-convert"
ENV ADDON_UNSUPPORTED="true"

RUN apk add --no-cache python3 python3-dev py3-pip bash git iw dnsmasq hostapd screen curl mosquitto haveged net-tools openssl openssl-dev gcc musl-dev linux-headers sudo coreutils grep iproute2 ncurses && \
    python3 -m venv $VIRTUAL_ENV && \
    pip install --no-cache-dir --upgrade paho-mqtt==1.6.1 tornado==6.4.2 git+https://github.com/drbild/sslpsk.git@d88123a75786953f82f5e25d6c43d9d9259acb62 pycryptodomex==3.20.0 && \
    git clone https://github.com/ct-Open-Source/tuya-convert /usr/local/tuya-convert

WORKDIR /usr/local/tuya-convert

RUN git checkout a34b2c91862ed855542e8a32a14a9ab7573c4de9 && \
    sed -i 's|ls -m|ls|' /usr/local/tuya-convert/scripts/setup_checks.sh

# Copy data for add-on
COPY start.sh /
RUN chmod a+x /start.sh
CMD [ "/start.sh" ]

# HEALTHCHECK disabled: This addon runs a one-time flash operation and exits.
# Traditional liveness checks don't apply to ephemeral, one-time operations.
HEALTHCHECK NONE

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
