ARG BUILD_FROM
# hadolint ignore=DL3006
FROM ${BUILD_FROM}
ARG BUILD_DATE

ARG NETBOOTXYZ_VERSION="0.7.6"

RUN \
  echo "**** install runtime packages ****" && \
  # hadolint ignore=DL3018
  apk add --no-cache \
    dnsmasq \
    nginx \
    nodejs \
    tftp-hpa && \
  echo "**** install build packages ****" && \
  apk add --no-cache --virtual=build-dependencies \
    npm && \
  echo "**** install WebApp version ${NETBOOTXYZ_VERSION} ****" && \
  curl -o /tmp/webapp.tar.gz -L https://github.com/netbootxyz/webapp/archive/${NETBOOTXYZ_VERSION}.tar.gz && \
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
ARG BUILD_DATE
RUN chmod a+x /etc/services.d/*/run

# Configure DNSMASQ
RUN chmod a+x /etc/cont-init.d/*

# Labels
LABEL org.opencontainers.image.title="Netboot.xyz"
LABEL org.opencontainers.image.description="PXE-Server to deploy a OS inside your local network"
LABEL org.opencontainers.image.vendor="FaserF's Home Assistant Add-ons"
LABEL org.opencontainers.image.authors="FaserF <https://github.com/FaserF>"
LABEL org.opencontainers.image.licenses="MIT"
LABEL org.opencontainers.image.url="https://github.com/FaserF/hassio-addons/tree/master/netboot-xyz"
LABEL org.opencontainers.image.source="https://github.com/FaserF/hassio-addons/tree/master/netboot-xyz"
LABEL org.opencontainers.image.documentation="https://github.com/FaserF/hassio-addons/blob/master/netboot-xyz/README.md"
LABEL org.opencontainers.image.created="${BUILD_DATE}"




