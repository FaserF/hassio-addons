ARG BUILD_FROM=ghcr.io/hassio-addons/base:19.0.0
# hadolint ignore=DL3006
FROM ${BUILD_FROM} AS builder

# Install requirements for building
# hadolint ignore=DL3018



# Addon metadata (injected by CI)
ENV ADDON_VERSION="2.1.4"
ENV ADDON_NAME="Switch LAN Play Server"
ENV ADDON_SLUG="switch-lan-play-server"
ENV ADDON_UNSUPPORTED="false"

RUN apk -U --no-cache add \
    libpcap-dev \
    libuv-dev \
    git \
    g++ \
    npm \
    build-base

# Install SLP
WORKDIR /switch-lan-play
# renovate: datasource=github-tags depName=spacemeowx2/switch-lan-play
ARG SWITCH_LAN_PLAY_VERSION="v0.2.3"
ENV SWITCH_LAN_PLAY_VERSION=${SWITCH_LAN_PLAY_VERSION}
RUN git clone --branch "${SWITCH_LAN_PLAY_VERSION}" --single-branch --depth 1 https://github.com/spacemeowx2/switch-lan-play.git .

WORKDIR /switch-lan-play/server
RUN npm install \
    && npm install typescript@4.9.5 --save-dev \
    && sed -i 's/"strict": true/"strict": false, "skipLibCheck": true/g' tsconfig.json \
    && npm run build

# Final Stage
# hadolint ignore=DL3006
FROM ${BUILD_FROM}
ARG BUILD_DATE="unknown"

# Install runtime requirements
# hadolint ignore=DL3018
RUN apk -U --no-cache add \
    libpcap \
    libuv \
    npm \
    coreutils

WORKDIR /switch-lan-play
COPY --from=builder /switch-lan-play/server /switch-lan-play/server

# Copy data for add-on
COPY run.sh /
RUN chmod a+x /run.sh

# Healthcheck
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD pgrep -x node >/dev/null || exit 1

WORKDIR /
CMD [ "/run.sh" ]

# Labels
LABEL \
    org.opencontainers.image.title="Switch LAN Play Server" \
    org.opencontainers.image.description="Nintendo Switch Lan Play -Server" \
    org.opencontainers.image.vendor="FaserF's Home Assistant Add-ons" \
    org.opencontainers.image.authors="FaserF <https://github.com/FaserF>" \
    org.opencontainers.image.licenses="MIT" \
    org.opencontainers.image.url="https://github.com/FaserF/hassio-addons/tree/master/switch_lan_play_server" \
    org.opencontainers.image.source="https://github.com/FaserF/hassio-addons/tree/master/switch_lan_play_server" \
    org.opencontainers.image.documentation="https://github.com/FaserF/hassio-addons/blob/master/switch_lan_play_server/README.md" \
    org.opencontainers.image.created="${BUILD_DATE}"
