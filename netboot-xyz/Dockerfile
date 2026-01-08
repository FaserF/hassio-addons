ARG BUILD_FROM=ghcr.io/hassio-addons/base:19.0.0
# hadolint ignore=DL3006
FROM ${BUILD_FROM}
ARG BUILD_DATE="1970-01-01T00:00:00Z"

ARG NETBOOTXYZ_VERSION="0.7.6"
ENV NETBOOTXYZ_VERSION=${NETBOOTXYZ_VERSION}
# renovate: datasource=github-releases depName=netbootxyz/webapp
ARG NETBOOTXYZ_SHA256="9b5a46830e60c51a36cbfff204d383f2d2f68969f12e24df0c74e76f2b637121"

# Set shell for pipefail support
SHELL ["/bin/ash", "-o", "pipefail", "-c"]

# hadolint ignore=DL3018

RUN \
  echo "**** install runtime packages ****" && \
  apk add --no-cache \
    bash \
    curl \
    dnsmasq \
    nginx \
    nodejs \
    tftp-hpa && \
  echo "**** install build packages ****" && \
  apk add --no-cache --virtual=build-dependencies \
    npm && \
  echo "**** install WebApp version ${NETBOOTXYZ_VERSION} ****" && \
  curl -o /tmp/webapp.tar.gz -L https://github.com/netbootxyz/webapp/archive/${NETBOOTXYZ_VERSION}.tar.gz && \
  echo "${NETBOOTXYZ_SHA256}  /tmp/webapp.tar.gz" | sha256sum -c - && \
  mkdir -p /app/ && tar xf /tmp/webapp.tar.gz -C \
    /app/ --strip-components=1 && \
  npm install --prefix /app && \
  echo "**** cleanup ****" && \
  apk del --purge \
    build-dependencies && \
  rm -rf \
    /tmp/*

# copy local files
COPY root/ /

# app runs on port 3000
EXPOSE 3000

# Ensure all run files from the services are executable
RUN chmod a+x /etc/cont-init.d/* /etc/services.d/*/run

# Health check
HEALTHCHECK --interval=30s --timeout=10s --retries=3 --start-period=30s \
  CMD curl --fail http://127.0.0.1:3000 || exit 1

# Labels
LABEL \
  org.opencontainers.image.title="Netboot.xyz" \
  org.opencontainers.image.description="PXE-Server to deploy a OS inside your local network" \
  org.opencontainers.image.vendor="FaserF's Home Assistant Add-ons" \
  org.opencontainers.image.authors="FaserF <https://github.com/FaserF>" \
  org.opencontainers.image.licenses="MIT" \
  org.opencontainers.image.url="https://github.com/FaserF/hassio-addons/tree/master/netboot-xyz" \
  org.opencontainers.image.source="https://github.com/FaserF/hassio-addons/tree/master/netboot-xyz" \
  org.opencontainers.image.documentation="https://github.com/FaserF/hassio-addons/blob/master/netboot-xyz/README.md" \
  org.opencontainers.image.created="${BUILD_DATE}"
