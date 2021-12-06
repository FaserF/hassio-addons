ARG BUILD_FROM=ghcr.io/hassio-addons/base/amd64:11.0.0
# hadolint ignore=DL3006
FROM ${BUILD_FROM}
ENV LANG C.UTF-8

RUN apk add --update bash git iw dnsmasq hostapd screen curl py3-pip py3-wheel python3-dev mosquitto haveged net-tools openssl openssl-dev gcc musl-dev linux-headers sudo coreutils grep iproute2
RUN python3 -m pip install --upgrade paho-mqtt tornado git+https://github.com/drbild/sslpsk.git pycryptodomex
RUN git clone --depth 1 https://github.com/ct-Open-Source/tuya-convert /usr/local/tuya-convert
RUN sed -i 's|ls -m|ls|' /usr/local/tuya-convert/scripts/setup_checks.sh
WORKDIR "/usr/local/tuya-convert"

# Copy data for add-on
COPY start.sh /
RUN chmod a+x /start.sh
CMD [ "/start.sh" ]