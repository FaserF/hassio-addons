ARG BUILD_FROM=ghcr.io/hassio-addons/base:20.0.3
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

# App metadata (injected by CI)
ENV APP_VERSION="1.0.0"
ENV APP_NAME="DBF (DB-Infoscreen)"
ENV APP_SLUG="dbf"
ENV APP_UNSUPPORTED="false"

WORKDIR /app

# Install dependencies and build db-infoscreen
# hadolint ignore=DL3003,DL3018
RUN \
    echo "http://dl-cdn.alpinelinux.org/alpine/v3.23/main" > /etc/apk/repositories \
    && echo "http://dl-cdn.alpinelinux.org/alpine/v3.23/community" >> /etc/apk/repositories \
    && apk add --no-cache musl musl-dev \
    && apk upgrade --no-cache --available \
    && apk add --no-cache \
        gcc \
        make \
        musl-dev \
        perl-dev \
        openssl-dev \
        libxml2-dev \
        zlib-dev \
        db-dev \
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
        perl-dbd-mysql \
        perl-dbd-sqlite \
        perl-datetime \
        perl-libwww \
    && git clone --depth 1 --branch "${DBF_VERSION}" https://github.com/derf/db-fakedisplay.git . \
    && cpanm -n --no-man-pages --installdeps . \
    && rm -rf ~/.cpanm \
    && mkdir -p /app/ext-templates \
    && ln -sf ../ext-templates/imprint.html.ep templates/imprint.html.ep \
    && ln -sf ../ext-templates/privacy.html.ep templates/privacy.html.ep

# Copy the patch script and apply it
COPY patch_ingress.pl /app/patch_ingress.pl
RUN perl /app/patch_ingress.pl /app/lib/DBInfoscreen.pm && rm /app/patch_ingress.pl

# Clean up build dependencies
RUN apk del --no-cache .build-dependencies

# Copy rootfs
COPY rootfs /

# Ensure scripts are executable and have Unix line endings
RUN find /usr/bin/dbf-* /etc/s6-overlay/s6-rc.d /etc/periodic -type f -exec sed -i 's/\r$//' {} + \
    && chmod a+x /usr/bin/dbf-update-data /usr/bin/dbf-integration-manager \
        /etc/s6-overlay/s6-rc.d/dbf/run \
        /etc/s6-overlay/s6-rc.d/dbf-periodic/run \
        /etc/periodic/daily/dbf-update-data \
    && rm -rf /etc/s6-overlay/s6-rc.d/dbf-nginx \
    && rm -f /etc/s6-overlay/s6-rc.d/user/contents.d/dbf-nginx

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
