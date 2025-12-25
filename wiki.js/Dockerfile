ARG BUILD_FROM=ghcr.io/hassio-addons/base:latest
# hadolint ignore=DL3006
FROM ${BUILD_FROM}
ARG BUILD_DATE
WORKDIR /usr/src/app
ARG NODE_VERSION="20.12.2"

SHELL ["/bin/bash", "-o", "pipefail", "-c"]

# Install Node.js and Yarn via APK
# hadolint ignore=DL3018
RUN apk add --no-cache nodejs npm yarn

WORKDIR /wiki
ARG WIKIJS_VERSION="v2.5.303"
# hadolint ignore=DL3047,DL4001
RUN wget https://github.com/Requarks/wiki/releases/download/${WIKIJS_VERSION}/wiki-js.tar.gz && \
    tar xzf wiki-js.tar.gz -C /wiki && \
    rm wiki-js.tar.gz && \
    rm /wiki/config.sample.yml

COPY run.sh /
RUN chmod a+x /run.sh
# Healthcheck
HEALTHCHECK \
    CMD curl --fail http://127.0.0.1:3000/ || exit 1

CMD [ "/run.sh" ]

# Labels
LABEL org.opencontainers.image.title="Wiki.JS"
LABEL org.opencontainers.image.description="The most powerful and extensible open source Wiki software"
LABEL org.opencontainers.image.vendor="FaserF's Home Assistant Add-ons"
LABEL org.opencontainers.image.authors="FaserF <https://github.com/FaserF>"
LABEL org.opencontainers.image.licenses="MIT"
LABEL org.opencontainers.image.url="https://github.com/FaserF/hassio-addons/tree/master/wiki.js"
LABEL org.opencontainers.image.source="https://github.com/FaserF/hassio-addons/tree/master/wiki.js"
LABEL org.opencontainers.image.documentation="https://github.com/FaserF/hassio-addons/blob/master/wiki.js/README.md"
LABEL org.opencontainers.image.created="${BUILD_DATE}"
