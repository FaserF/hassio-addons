ARG BUILD_FROM=ghcr.io/hassio-addons/base:19.0.0
# Use official image pinned to digest to ensure integrity (CodeRabbit: reproducible builds)
# Note: This uses Wiki.js V3 Beta/Alpha - update digest when new versions are released
# The digest is tracked by Renovate via custom manager in .github/renovate.json
FROM ghcr.io/requarks/wiki:3.0.0-alpha@sha256:6335f9dd790f1c973ffd48e0c45ae201739e98f8d332b495a6cc159d3cdcfaa6 AS wiki_release

# hadolint ignore=DL3006
FROM ${BUILD_FROM}
ARG BUILD_DATE="unknown"

# Install Node.js, Yarn and MariaDB client via APK
# hadolint ignore=DL3018





# Addon metadata (injected by CI)
ENV ADDON_VERSION="0.2.1"
ENV ADDON_NAME="Wiki.JS V3 (Beta)"
ENV ADDON_SLUG="wikijs3"
ENV ADDON_UNSUPPORTED="false"

RUN apk add --no-cache \
    --repository=http://dl-cdn.alpinelinux.org/alpine/edge/main \
    --repository=http://dl-cdn.alpinelinux.org/alpine/edge/community \
    nodejs npm yarn wget dos2unix postgresql postgresql-client postgresql-contrib su-exec \
    && mkdir -p /var/lib/postgresql/data /run/postgresql \
    && chown -R postgres:postgres /var/lib/postgresql /run/postgresql

WORKDIR /wiki
COPY --from=wiki_release /wiki .
# Reinstall dependencies for Node 24 compatibility
RUN apk add --no-cache --virtual .build-deps build-base python3 && \
    rm -rf node_modules && \
    yarn install --production && \
    yarn cache clean && \
    apk del .build-deps
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
    org.opencontainers.image.title="Wiki.JS V3 (Beta)" \
    org.opencontainers.image.description="The most powerful and extensible open source Wiki software (Version 3 - Beta)" \
    org.opencontainers.image.vendor="FaserF's Home Assistant Add-ons" \
    org.opencontainers.image.authors="FaserF <https://github.com/FaserF>" \
    org.opencontainers.image.licenses="MIT" \
    org.opencontainers.image.url="https://github.com/FaserF/hassio-addons/tree/master/wiki.js3" \
    org.opencontainers.image.source="https://github.com/FaserF/hassio-addons/tree/master/wiki.js3" \
    org.opencontainers.image.documentation="https://github.com/FaserF/hassio-addons/blob/master/wiki.js3/README.md" \
    org.opencontainers.image.created="${BUILD_DATE}"
