ARG HA_VERSION=2026.1.3
ARG BUILD_FROM=ghcr.io/home-assistant/home-assistant:${HA_VERSION}
# hadolint ignore=DL3006
FROM ghcr.io/hassio-addons/base:20.0.1 AS addon-base

# hadolint ignore=DL3006
FROM ${BUILD_FROM}

ARG HA_VERSION
ARG BUILD_DATE="unknown"
ENV HA_VERSION="${HA_VERSION}"
ENV TERM="xterm-256color"

# Install dependencies for Bashio (use default shell for Alpine)

# Addon metadata (injected by CI)
ENV ADDON_VERSION="0.2.3"
ENV ADDON_NAME="Home Assistant Test Instance"
ENV ADDON_SLUG="ha_test_instance"
ENV ADDON_UNSUPPORTED="false"

RUN apk add --no-cache -u libssl3 libcrypto3 \
    bash \
    curl \
    jq \
    sed

# Set shell to bash after installation
SHELL ["/bin/bash", "-o", "pipefail", "-c"]

# Copy Bashio and Tempio
COPY --from=addon-base /usr/bin/bashio /usr/bin/bashio
COPY --from=addon-base /usr/lib/bashio /usr/lib/bashio
COPY --from=addon-base /usr/bin/tempio /usr/bin/tempio

# Addon metadata (injected by CI)
ARG ADDON_VERSION="0.2.1"
ARG ADDON_NAME="Home Assistant Test Instance"
ARG ADDON_SLUG="ha_test_instance"
ARG ADDON_UNSUPPORTED="false"

ENV \
    ADDON_VERSION="${ADDON_VERSION}" \
    ADDON_NAME="${ADDON_NAME}" \
    ADDON_SLUG="${ADDON_SLUG}" \
    ADDON_UNSUPPORTED="${ADDON_UNSUPPORTED}"

COPY run.sh /run.sh
RUN chmod a+x /run.sh

EXPOSE 8123

# Persist data in the add-on data directory
CMD [ "/run.sh" ]

# Health check
HEALTHCHECK --interval=60s --timeout=15s --start-period=60s --retries=3 \
    CMD curl --fail --connect-timeout 5 --max-time 10 http://127.0.0.1:8123 || exit 1

# Labels
LABEL \
    org.opencontainers.image.title="Home Assistant Test Instance" \
    org.opencontainers.image.description="A standalone Home Assistant Core instance for testing purposes." \
    org.opencontainers.image.vendor="FaserF's Home Assistant Add-ons" \
    org.opencontainers.image.authors="FaserF <https://github.com/FaserF>" \
    org.opencontainers.image.licenses="MIT" \
    org.opencontainers.image.url="https://github.com/FaserF/hassio-addons/tree/master/homeassistant-test-instance" \
    org.opencontainers.image.source="https://github.com/FaserF/hassio-addons/tree/master/homeassistant-test-instance" \
    org.opencontainers.image.documentation="https://github.com/FaserF/hassio-addons/blob/master/homeassistant-test-instance/README.md" \
    org.opencontainers.image.created="${BUILD_DATE}"
