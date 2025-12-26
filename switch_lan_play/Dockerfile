ARG BUILD_FROM=ghcr.io/hassio-addons/base:19.0.0
# Build stage
# hadolint ignore=DL3006
FROM ${BUILD_FROM} AS builder

# Install build dependencies
# hadolint ignore=DL3018
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

# Install runtime dependencies (procps for pgrep)
# hadolint ignore=DL3018
RUN apk add --no-cache \
    libpcap \
    libuv \
    procps

# Copy binary from builder
COPY --from=builder /switch-lan-play/build/src/lan-play /usr/local/bin/lan-play

# Copy data for add-on
COPY run.sh /
RUN chmod a+x /run.sh

CMD [ "/run.sh" ]

# Healthcheck
HEALTHCHECK --interval=300s --timeout=3s \
    CMD pgrep lan-play || exit 1

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
