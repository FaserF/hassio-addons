ARG BUILD_FROM=ghcr.io/hassio-addons/base-python/amd64:7.2.0
# hadolint ignore=DL3006
FROM ${BUILD_FROM}
ENV LANG C.UTF-8

# Create directory for FDU
#RUN mkdir -p '/opt/freenom_dns_updater'
#COPY . /opt/freenom_dns_updater/
#WORKDIR /opt/freenom_dns_updater
RUN pip install freenom-dns-updater
#RUN rm -rf /opt/freenom_dns_updater

#apk add
RUN apk add --no-cache zlib openssl-dev binutils

# Copy data for add-on
#ENTRYPOINT [ "fdu" ]
#CMD [ "process", "-i", "-c", "-r", "-t", "3600", "/etc/freenom.yml" ]
COPY run.sh /
RUN chmod a+x /run.sh
CMD [ "/run.sh" ]
