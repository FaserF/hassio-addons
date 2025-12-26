ARG BUILD_FROM=ghcr.io/home-assistant/home-assistant:2025.12.4
# hadolint ignore=DL3006
FROM ${BUILD_FROM}
ARG BUILD_DATE="unknown"
EXPOSE 8123

# Persist data in the add-on data directory
CMD [ "hass", "-c", "/data" ]


# Health check
HEALTHCHECK --interval=60s --timeout=15s --start-period=60s --retries=3 \
    CMD python3 -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8123')" || exit 1

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
