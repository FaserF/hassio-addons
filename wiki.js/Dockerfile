ARG BUILD_FROM=ghcr.io/hassio-addons/base:13.2.2
# hadolint ignore=DL3006
FROM ${BUILD_FROM}

# Set shell
SHELL ["/bin/bash", "-o", "pipefail", "-c"]

# Setup base
# hadolint ignore=DL3003
RUN \
    apk add --no-cache \
    nodejs \
    wget \
    tar \
    mariadb-client

WORKDIR /wiki
ARG WIKIJS_VERSION="v2.5.298"
RUN wget https://github.com/Requarks/wiki/releases/download/${WIKIJS_VERSION}/wiki-js.tar.gz

RUN tar xzf wiki-js.tar.gz -C /wiki
RUN rm wiki-js.tar.gz
RUN rm /wiki/config.sample.yml

# Copy data for add-on
COPY run.sh /
#COPY config.yml /wiki/
RUN chmod a+x /run.sh
CMD [ "/run.sh" ]
