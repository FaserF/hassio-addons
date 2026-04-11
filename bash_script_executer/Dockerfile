ARG BUILD_FROM=ghcr.io/hassio-addons/base:20.0.3
# hadolint ignore=DL3006
FROM ${BUILD_FROM}
ARG BUILD_DATE="unknown"

# hadolint ignore=DL3018

# App metadata (injected by CI)
ENV APP_VERSION="2.4.1"
ENV APP_NAME="Bash Script Executer"
ENV APP_SLUG="bashscriptexecuter"
ENV APP_UNSUPPORTED="false"

RUN \
    echo "http://dl-cdn.alpinelinux.org/alpine/v3.23/main" > /etc/apk/repositories \
    && echo "http://dl-cdn.alpinelinux.org/alpine/v3.23/community" >> /etc/apk/repositories \
    && apk add --no-cache --available musl musl-dev \
    && apk upgrade --no-cache --available \
    && apk add --no-cache \
    bash \
    curl \
    jq \
    coreutils \
    findutils \
    grep \
    sed \
    gawk \
    imagemagick \
    mosquitto-clients \
    openssh-client \
    git \
    rsync \
    tar \
    unzip \
    zip \
    wget \
    iputils \
    net-tools \
    bind-tools \
    dos2unix \
    tzdata

# Copy data for add-on
COPY integration /integration
COPY run.sh /

# Health check - verify run.sh process is running
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD pgrep -f run.sh >/dev/null || exit 1

RUN chmod a+x /run.sh
CMD [ "/run.sh" ]

# Labels
LABEL \
    org.opencontainers.image.title="Bash Script Executer" \
    org.opencontainers.image.description="Execute your own bash scripts inside this Homeassistant Addon environment." \
    org.opencontainers.image.vendor="FaserF's Home Assistant Apps" \
    org.opencontainers.image.authors="FaserF <https://github.com/FaserF>" \
    org.opencontainers.image.licenses="MIT" \
    org.opencontainers.image.url="https://github.com/FaserF/hassio-addons/tree/master/bash_script_executer" \
    org.opencontainers.image.source="https://github.com/FaserF/hassio-addons/tree/master/bash_script_executer" \
    org.opencontainers.image.documentation="https://github.com/FaserF/hassio-addons/blob/master/bash_script_executer/README.md" \
    org.opencontainers.image.created="${BUILD_DATE}"
