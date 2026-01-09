ARG BUILD_FROM=ghcr.io/hassio-addons/base:19.0.0
# Build stage
# hadolint ignore=DL3006
FROM ${BUILD_FROM} AS builder

# Install build dependencies
# hadolint ignore=DL3018

# Addon metadata (injected by CI)
ENV ADDON_VERSION="2.1.1"
ENV ADDON_NAME="Switch LAN Play Client"
ENV ADDON_SLUG="switch-lan-play"
ENV ADDON_UNSUPPORTED="false"

RUN apk add --no-cache \
    libpcap-dev \
    libuv-dev \
    git \
    g++ \
    cmake \
    build-base

# Pin to specific commit for reproducible builds (v0.2.3)
WORKDIR /switch-lan-play
# hadolint ignore=DL3003
RUN git clone https://github.com/spacemeowx2/switch-lan-play.git . \
    && git checkout c0c663e3fdc95d6d6e8ab401caa2bfb5b5872e00 \
    && mkdir build \
    && cd build \
    && cmake .. \
    && make

# Runtime stage
# hadolint ignore=DL3006
FROM ${BUILD_FROM}
ARG BUILD_DATE="unknown"
# Version pinned to commit c0c663e3fdc95d6d6e8ab401caa2bfb5b5872e00 = v0.2.3
ENV SWITCH_LAN_PLAY_VERSION="v0.2.3"

# Install runtime dependencies (procps for pgrep)
# hadolint ignore=DL3018
RUN apk add --no-cache \
    libpcap \
    libuv \
    procps \
    libstdc++ \
    libgcc

# Copy binary from builder
COPY --from=builder /switch-lan-play/build/src/lan-play /usr/local/bin/lan-play

# Copy data for add-on
COPY run.sh /
RUN chmod a+x /run.sh

CMD [ "/run.sh" ]

# Healthcheck - check if lan-play process is running
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD pgrep -f "lan-play" >/dev/null || exit 1

# Labels
LABEL org.opencontainers.image.title="Switch LAN Play Client"
LABEL org.opencontainers.image.description="Nintendo Switch Lan Play -Client"
LABEL org.opencontainers.image.vendor="FaserF's Home Assistant Add-ons"
LABEL org.opencontainers.image.authors="FaserF <https://github.com/FaserF>"
LABEL org.opencontainers.image.licenses="MIT"
LABEL org.opencontainers.image.url="https://github.com/FaserF/hassio-addons/tree/master/switch_lan_play"
LABEL org.opencontainers.image.source="https://github.com/FaserF/hassio-addons/tree/master/switch_lan_play"
LABEL org.opencontainers.image.documentation="https://github.com/FaserF/hassio-addons/blob/master/switch_lan_play/README.md"
LABEL org.opencontainers.image.created="${BUILD_DATE}"
