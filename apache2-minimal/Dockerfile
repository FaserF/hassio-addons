ARG BUILD_FROM=ghcr.io/hassio-addons/base/amd64:9.2.0
# hadolint ignore=DL3006
FROM ${BUILD_FROM}
ENV LANG C.UTF-8

# Create directory for apache2 to store PID file
RUN mkdir /run/apache2

RUN apk update && apk upgrade
RUN apk --no-cache add apache2 libxml2-dev apache2-utils apache2-mod-wsgi apache2-ssl

# Copy data for add-on
COPY run.sh /
COPY index.html /
RUN chmod a+x /run.sh
RUN chmod a+x /index.html
CMD [ "/run.sh" ]
