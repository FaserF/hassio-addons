ARG BUILD_FROM=ghcr.io/hassio-addons/base:latest
# hadolint ignore=DL3006
FROM ${BUILD_FROM} AS builder
ARG BUILD_DATE

# Set shell
SHELL ["/bin/bash", "-o", "pipefail", "-c"]

# hadolint ignore=DL3018
RUN apk --no-cache add wget go git tar
ARG MATTERBRIDGE_VERSION="v1.26.0"

WORKDIR /matterbridge
RUN wget -qO- https://github.com/42wim/matterbridge/archive/refs/tags/${MATTERBRIDGE_VERSION}.tar.gz | tar xz --strip-components=1 \
  && CGO_ENABLED=0 go build -tags whatsappmulti -mod vendor -ldflags "-X github.com/42wim/matterbridge/version.GitHash=${MATTERBRIDGE_VERSION}" -o /bin/matterbridge

# hadolint ignore=DL3006
FROM ${BUILD_FROM}
ARG BUILD_DATE
# hadolint ignore=DL3018
RUN apk --no-cache add ca-certificates mailcap

# Re-declare ARG after FROM to make it available in this build stage
ARG BUILD_DATE

COPY --from=builder /bin/matterbridge /bin/matterbridge
RUN mkdir /etc/matterbridge \
  && touch /etc/matterbridge/matterbridge.toml \
  && ln -sf /matterbridge.toml /etc/matterbridge/matterbridge.toml

# Copy data for add-on
COPY run.sh /
RUN chmod a+x /run.sh \
    && chmod a+x /bin/matterbridge
# Healthcheck
HEALTHCHECK \
    CMD pgrep matterbridge || exit 1

CMD [ "/run.sh" ]

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
