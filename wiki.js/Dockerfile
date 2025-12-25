ARG BUILD_FROM=ghcr.io/hassio-addons/base:19.0.0
ARG WIKIJS_VERSION="v2.5.303"

# Use official image pinned to digest to ensure integrity (CodeRabbit: reproducible builds)
# renovate: datasource=docker depName=ghcr.io/requarks/wiki
FROM ghcr.io/requarks/wiki:2@sha256:3d20706341a35b3f50d339d26e791b3e87d7cbc848bc002cf47a542ddf3dcd43 AS wiki_release

FROM ${BUILD_FROM}
ARG BUILD_DATE
SHELL ["/bin/bash", "-o", "pipefail", "-c"]

# Install Node.js and Yarn via APK
# hadolint ignore=DL3018
RUN apk add --no-cache nodejs npm yarn

WORKDIR /wiki
COPY --from=wiki_release /wiki .
RUN rm -f /wiki/config.sample.yml

COPY run.sh /
RUN chmod a+x /run.sh
# Healthcheck (use wget since it's available in base image)
HEALTHCHECK CMD wget --spider -q http://127.0.0.1:3000/ || exit 1

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
