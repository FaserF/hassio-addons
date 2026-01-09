ARG BUILD_FROM=ghcr.io/hassio-addons/base:19.0.0
ARG WIKIJS_VERSION=2.5.311
FROM ghcr.io/requarks/wiki:${WIKIJS_VERSION} AS wiki_release

# hadolint ignore=DL3006
FROM ${BUILD_FROM}
ARG BUILD_DATE="unknown"

# Install Node.js, Yarn and MariaDB client via APK
# hadolint ignore=DL3018

# Addon metadata (injected by CI)
ENV ADDON_VERSION="3.1.0"
ENV ADDON_NAME="Wiki.JS"
ENV ADDON_SLUG="wiki.js"
ENV ADDON_UNSUPPORTED="false"

RUN apk add --no-cache nodejs npm yarn wget dos2unix mariadb-client

WORKDIR /wiki
COPY --from=wiki_release /wiki .
# Extract and persist Wiki.js version for runtime banner
RUN WIKIJS_VERSION=$(node -p "require('./package.json').version" 2>/dev/null || echo "unknown") && \
    echo "WIKIJS_VERSION=${WIKIJS_VERSION}" >> /etc/environment && \
    rm -f /wiki/config.sample.yml

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
