ARG BUILD_FROM=ghcr.io/hassio-addons/base:15.0.7
# hadolint ignore=DL3006
FROM ${BUILD_FROM}

RUN apk update && apk upgrade
RUN apk --no-cache add openssl

# Copy data for add-on
COPY run.sh /
RUN chmod a+x /run.sh
CMD [ "/run.sh" ]