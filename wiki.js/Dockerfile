ARG BUILD_FROM=ghcr.io/hassio-addons/base/amd64:9.2.0
# hadolint ignore=DL3006
FROM ${BUILD_FROM}

RUN apk --no-cache add nodejs wget tar mariadb-client

WORKDIR /wiki
RUN wget https://github.com/Requarks/wiki/releases/download/2.5.191/wiki-js.tar.gz

RUN tar xzf wiki-js.tar.gz -C /wiki
RUN rm wiki-js.tar.gz
RUN rm /wiki/config.sample.yml

# Copy data for add-on
COPY run.sh /
#COPY config.yml /wiki/
RUN chmod a+x /run.sh
CMD [ "/run.sh" ]
