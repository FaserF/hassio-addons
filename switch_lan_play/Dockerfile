ARG BUILD_FROM
# hadolint ignore=DL3006
FROM ${BUILD_FROM}

# Install requirements for add-on
# hadolint ignore=DL3018
RUN apk -U --no-cache add \
    libpcap-dev \
    libuv-dev \
    git \
    g++ \
    cmake \
    nano \
    screen \
    build-base

#Install SLP Client
WORKDIR /switch-lan-play
RUN git clone https://github.com/spacemeowx2/switch-lan-play.git . \
    && mkdir build \
    && cd build \
    && cmake .. \
    && make \
    && cd src \
    && chmod +x lan-play \
    && cp lan-play /

# Copy data for add-on
COPY run.sh /
RUN chmod a+x /run.sh

CMD [ "/run.sh" ]

# Labels
LABEL org.opencontainers.image.title="Switch LAN Play Client"
LABEL org.opencontainers.image.description="Nintendo Switch Lan Play -Client"
LABEL org.opencontainers.image.vendor="FaserF's Home Assistant Add-ons"
LABEL org.opencontainers.image.authors="FaserF <https://github.com/FaserF>"
LABEL org.opencontainers.image.licenses="MIT"
LABEL org.opencontainers.image.url="https://github.com/FaserF/hassio-addons/tree/master/switch_lan_play"
LABEL org.opencontainers.image.source="https://github.com/FaserF/hassio-addons/tree/master/switch_lan_play"
LABEL org.opencontainers.image.documentation="https://github.com/FaserF/hassio-addons/tree/master/switch_lan_play/blob/master/switch_lan_play/README.md"
LABEL org.opencontainers.image.created="2025-12-24"
