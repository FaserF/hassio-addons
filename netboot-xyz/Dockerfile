ARG BUILD_FROM=ghcr.io/hassio-addons/base:13.2.2
# hadolint ignore=DL3006
FROM ${BUILD_FROM}

ARG NETBOOTXYZ_VERSION="0.6.6"

RUN \
  echo "**** install runtime packages ****" && \
  apk add --no-cache \
    nginx \
    nodejs \
    tftp-hpa && \
  echo "**** install build packages ****" && \
  apk add --no-cache --virtual=build-dependencies \
    npm && \
  echo "**** install WebApp version ${NETBOOTXYZ_VERSION} ****" && \
  curl -o /tmp/webapp.tar.gz -L https://github.com/netbootxyz/webapp/archive/${NETBOOTXYZ_VERSION}.tar.gz && \
  tar xf \
  /tmp/webapp.tar.gz -C \
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

# Configure DNSMASQ
RUN chmod a+x /etc/cont-init.d/*
