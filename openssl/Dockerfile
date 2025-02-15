ARG BUILD_FROM
# hadolint ignore=DL3006
FROM ${BUILD_FROM}

RUN apk update && apk upgrade
RUN apk --no-cache add openssl

# Copy data for add-on
COPY run.sh /
RUN chmod a+x /run.sh
CMD [ "/run.sh" ]