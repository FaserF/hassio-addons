ARG BUILD_FROM=ghcr.io/hassio-addons/base:19.0.0
# Use official image pinned to digest to ensure integrity (CodeRabbit: reproducible builds)
# renovate: datasource=docker depName=ghcr.io/requarks/wiki
FROM ghcr.io/requarks/wiki:2@sha256:1eaa2de751c2925871a95a02e0ddbdd5c48bf2e016653b2e4a8f0c646cc4ff83 AS wiki_release

# hadolint ignore=DL3006
FROM ${BUILD_FROM}
ARG BUILD_DATE="unknown"

# Install Node.js and Yarn via APK
# hadolint ignore=DL3018
RUN apk add --no-cache nodejs npm yarn wget dos2unix

WORKDIR /wiki
COPY --from=wiki_release /wiki .
RUN rm -f /wiki/config.sample.yml

COPY run.sh /
RUN chmod a+x /run.sh \
    && dos2unix /run.sh
# Healthcheck (use wget since it's available in base image)
HEALTHCHECK --interval=30s --timeout=15s --start-period=30s --retries=3 \
    CMD wget --spider -q http://127.0.0.1:3000/ || exit 1

CMD [ "/run.sh" ]

# Labels
LABEL \
    org.opencontainers.image.title="Wiki.JS" \
    org.opencontainers.image.description="The most powerful and extensible open source Wiki software" \
    org.opencontainers.image.vendor="FaserF's Home Assistant Add-ons" \
    org.opencontainers.image.authors="FaserF <https://github.com/FaserF>" \
    org.opencontainers.image.licenses="MIT" \
    org.opencontainers.image.url="https://github.com/FaserF/hassio-addons/tree/master/wiki.js" \
    org.opencontainers.image.source="https://github.com/FaserF/hassio-addons/tree/master/wiki.js" \
    org.opencontainers.image.documentation="https://github.com/FaserF/hassio-addons/blob/master/wiki.js/README.md" \
    org.opencontainers.image.created="${BUILD_DATE}"
