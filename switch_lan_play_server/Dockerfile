ARG BUILD_FROM
ARG BUILD_DATE
# hadolint ignore=DL3006
FROM ${BUILD_FROM}
ARG BUILD_DATE

# Install requirements for add-on
# hadolint ignore=DL3018
RUN apk -U --no-cache add \
    libpcap-dev \
    libuv-dev \
    git \
    g++ \
    npm \
    nano \
    screen \
    build-base

#Install SLP
WORKDIR /switch-lan-play
RUN git clone https://github.com/spacemeowx2/switch-lan-play.git . \
    && cd server \
    && npm install \
    && npm run build

# Copy data for add-on
COPY run.sh /
RUN chmod a+x /run.sh

CMD [ "/run.sh" ]

# Labels
LABEL org.opencontainers.image.title="Switch LAN Play Server"
LABEL org.opencontainers.image.description="Nintendo Switch Lan Play -Server"
LABEL org.opencontainers.image.vendor="FaserF's Home Assistant Add-ons"
LABEL org.opencontainers.image.authors="FaserF <https://github.com/FaserF>"
LABEL org.opencontainers.image.licenses="MIT"
LABEL org.opencontainers.image.url="https://github.com/FaserF/hassio-addons/tree/master/switch_lan_play_server"
LABEL org.opencontainers.image.source="https://github.com/FaserF/hassio-addons/tree/master/switch_lan_play_server"
LABEL org.opencontainers.image.documentation="https://github.com/FaserF/hassio-addons/blob/master/switch_lan_play_server/README.md"
LABEL org.opencontainers.image.created="${BUILD_DATE}"
