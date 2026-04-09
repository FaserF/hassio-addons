# ARG BASE_IMAGE points to the hassio-addons base image
# This allows building for multiple architectures
ARG BUILD_FROM
FROM ${BUILD_FROM}

# Build arguments
ARG BUILD_DATE="1970-01-01T00:00:00Z"
ARG BUILD_REF="main"
ARG BUILD_VERSION="dev"

# Set shell
SHELL ["/bin/bash", "-o", "pipefail", "-c"]

# Setup environment
ENV \
    LANG="C.UTF-8" \
    PS1="$(whoami)@$(hostname):$(pwd)$ " \
    DBFAKEDISPLAY_IRIS_CACHE="/data/iris_cache" \
    DBFAKEDISPLAY_IRISRT_CACHE="/data/irisrt_cache" \
    DBFAKEDISPLAY_STATS="/data/stats.json" \
    DBFAKEDISPLAY_LISTEN="http://*:8092" \
    DBFAKEDISPLAY_WORKERS=2

# Build arguments
ARG DBF_VERSION="4.37.28"

# Install dependencies and build db-infoscreen
# hadolint ignore=DL3003,DL3018
RUN \
    apk add --no-cache --virtual .build-dependencies \
        gcc \
        make \
        musl-dev \
        perl-dev \
        openssl-dev \
        libxml2-dev \
        zlib-dev \
        db-dev \
    && apk add --no-cache \
        perl \
        perl-app-cpanminus \
        perl-io-socket-ssl \
        perl-json-xs \
        perl-xml-libxml \
        libxml2 \
        openssl \
        zlib \
        db \
        curl \
        git \
    && git clone --depth 1 --branch "${DBF_VERSION}" https://github.com/derf/db-fakedisplay.git /app \
    && cd /app \
    && cpanm -n --no-man-pages --installdeps . \
    && rm -rf ~/.cpanm \
    && mkdir -p /app/ext-templates \
    && ln -sf ../ext-templates/imprint.html.ep templates/imprint.html.ep \
    && ln -sf ../ext-templates/privacy.html.ep templates/privacy.html.ep \
    && apk del --no-cache .build-dependencies

# Copy rootfs
COPY rootfs /

# Ensure scripts are executable and have Unix line endings
RUN find /usr/bin/dbf-* /etc/s6-overlay/s6-rc.d /etc/periodic -type f -exec sed -i 's/\r$//' {} + \
    && chmod a+x /usr/bin/dbf-update-data /usr/bin/dbf-integration-manager /etc/s6-overlay/s6-rc.d/dbf/run /etc/s6-overlay/s6-rc.d/dbf-periodic/run /etc/periodic/daily/dbf-update-data

# Metadata
LABEL \
    org.opencontainers.image.title="DBF (DB-Infoscreen)" \
    org.opencontainers.image.description="Railway departure display (formerly db-fakescreen) as a Home Assistant App." \
    org.opencontainers.image.vendor="FaserF's Home Assistant Apps" \
    org.opencontainers.image.authors="FaserF" \
    org.opencontainers.image.licenses="MIT" \
    org.opencontainers.image.url="https://github.com/FaserF/hassio-addons" \
    org.opencontainers.image.source="https://github.com/FaserF/hassio-addons" \
    org.opencontainers.image.documentation="https://github.com/FaserF/hassio-addons/tree/master/dbf" \
    org.opencontainers.image.created=${BUILD_DATE} \
    org.opencontainers.image.revision=${BUILD_REF} \
    org.opencontainers.image.version=${BUILD_VERSION}

WORKDIR /app

# Healthcheck
HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
    CMD curl --fail http://localhost:8092/ || exit 1
