ARG BUILD_FROM=ghcr.io/hassio-addons/base:19.0.0
# hadolint ignore=DL3006
FROM ${BUILD_FROM}
ARG BUILD_DATE

# hadolint ignore=DL3018
RUN \
# hadolint ignore=DL3018
apk add --no-cache ca-certificates curl tini tzdata; \
mkdir -p /etc/pterodactyl /var/log/pterodactyl /tmp/pterodactyl

# Download wings binary with multi-arch support
ARG TARGETARCH
RUN if [ "${TARGETARCH}" = "arm64" ]; then ARCH="arm64"; else ARCH="amd64"; fi && \
    curl -L -o /usr/local/bin/wings "https://github.com/pterodactyl/wings/releases/latest/download/wings_linux_${ARCH}" \
    && chmod u+x /usr/local/bin/wings

# Copy data for add-on
COPY run.sh /
RUN chmod a+x /run.sh
CMD [ "/run.sh" ]


# Health check
HEALTHCHECK --interval=60s --timeout=15s --retries=3 CMD curl --fail http://127.0.0.1:8080 || exit 1

# Labels
LABEL org.opencontainers.image.title="pterodactyl Wings Gameserver"
LABEL org.opencontainers.image.description="Open Source Gameserver"
LABEL org.opencontainers.image.vendor="FaserF's Home Assistant Add-ons"
LABEL org.opencontainers.image.authors="FaserF <https://github.com/FaserF>"
LABEL org.opencontainers.image.licenses="MIT"
LABEL org.opencontainers.image.url="https://github.com/FaserF/hassio-addons/tree/master/pterodactyl-wings"
LABEL org.opencontainers.image.source="https://github.com/FaserF/hassio-addons/tree/master/pterodactyl-wings"
LABEL org.opencontainers.image.documentation="https://github.com/FaserF/hassio-addons/blob/master/pterodactyl-wings/README.md"
LABEL org.opencontainers.image.created="${BUILD_DATE}"
