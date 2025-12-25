ARG HA_VERSION=stable
FROM ghcr.io/home-assistant/home-assistant:$HA_VERSION
ARG BUILD_DATE

# Re-declare ARG after FROM to make it available in this build stage
ARG BUILD_DATE
ARG BUILD_DATE

# Persist data in the add-on data directory
CMD [ "hass", "-c", "/data" ]


# Health check
HEALTHCHECK CMD curl --fail http://127.0.0.1:8123 || exit 1

# Labels
LABEL org.opencontainers.image.title="Home Assistant Test Instance"
LABEL org.opencontainers.image.description="A standalone Home Assistant Core instance for testing purposes."
LABEL org.opencontainers.image.vendor="FaserF's Home Assistant Add-ons"
LABEL org.opencontainers.image.authors="FaserF <https://github.com/FaserF>"
LABEL org.opencontainers.image.licenses="MIT"
LABEL org.opencontainers.image.url="https://github.com/FaserF/hassio-addons/tree/master/homeassistant-test-instance"
LABEL org.opencontainers.image.source="https://github.com/FaserF/hassio-addons/tree/master/homeassistant-test-instance"
LABEL org.opencontainers.image.documentation="https://github.com/FaserF/hassio-addons/blob/master/homeassistant-test-instance/README.md"
LABEL org.opencontainers.image.created="${BUILD_DATE}"
