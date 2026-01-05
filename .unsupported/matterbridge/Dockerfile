ARG BUILD_FROM=ghcr.io/hassio-addons/base:19.0.0
# hadolint ignore=DL3006
FROM ${BUILD_FROM} AS builder


# Set shell
SHELL ["/bin/bash", "-o", "pipefail", "-c"]

# hadolint ignore=DL3018





# Addon metadata (injected by CI)
ENV ADDON_VERSION="2.0.0"
ENV ADDON_NAME="Matterbridge"
ENV ADDON_SLUG="matterbridge"
ENV ADDON_UNSUPPORTED="false"

RUN apk --no-cache add wget go tar
# Version and checksum must be updated together
# Find checksums at: https://github.com/42wim/matterbridge/releases
ARG MATTERBRIDGE_VERSION="v1.26.0"
ARG MATTERBRIDGE_SHA256="00e1bbfe3b32f2feccf9a7f13a6f12b1ce28a5eb04cc7b922b344e3493497425"

WORKDIR /matterbridge
RUN wget -qO /tmp/matterbridge.tar.gz https://github.com/42wim/matterbridge/archive/refs/tags/${MATTERBRIDGE_VERSION}.tar.gz \
  && echo "${MATTERBRIDGE_SHA256}  /tmp/matterbridge.tar.gz" | sha256sum -c - \
  && tar xzf /tmp/matterbridge.tar.gz --strip-components=1 \
  && rm /tmp/matterbridge.tar.gz \
  && CGO_ENABLED=0 go build -tags whatsappmulti -mod vendor -ldflags "-X github.com/42wim/matterbridge/version.GitHash=${MATTERBRIDGE_VERSION}" -o /bin/matterbridge

# hadolint ignore=DL3006
FROM ${BUILD_FROM}
ARG BUILD_DATE="1970-01-01T00:00:00Z"
ARG MATTERBRIDGE_VERSION
ENV MATTERBRIDGE_VERSION=${MATTERBRIDGE_VERSION}
# hadolint ignore=DL3018
RUN apk --no-cache add ca-certificates mailcap

COPY --from=builder /bin/matterbridge /bin/matterbridge
RUN mkdir /etc/matterbridge \
  && touch /etc/matterbridge/matterbridge.toml \
  && ln -sf /matterbridge.toml /etc/matterbridge/matterbridge.toml

# Copy data for add-on
WORKDIR /
COPY run.sh /etc/services.d/matterbridge/run
RUN chmod +x /etc/services.d/matterbridge/run

# Healthcheck
HEALTHCHECK --interval=30s --timeout=30s --start-period=30s --retries=3 \
    CMD pgrep -x matterbridge || exit 1

# Labels
LABEL org.opencontainers.image.title="Matterbridge"
LABEL org.opencontainers.image.description="A simple chat bridge between different messenger apps"
LABEL org.opencontainers.image.vendor="FaserF's Home Assistant Add-ons"
LABEL org.opencontainers.image.authors="FaserF <https://github.com/FaserF>"
LABEL org.opencontainers.image.licenses="MIT"
LABEL org.opencontainers.image.url="https://github.com/FaserF/hassio-addons/tree/master/matterbridge"
LABEL org.opencontainers.image.source="https://github.com/FaserF/hassio-addons/tree/master/matterbridge"
LABEL org.opencontainers.image.documentation="https://github.com/FaserF/hassio-addons/blob/master/matterbridge/README.md"
LABEL org.opencontainers.image.created="${BUILD_DATE}"
