ARG BUILD_FROM=ghcr.io/hassio-addons/base-python:10.0.0
# hadolint ignore=DL3006
FROM ${BUILD_FROM}

# Create directory for FDU
#RUN mkdir -p '/opt/freenom_dns_updater'
#COPY . /opt/freenom_dns_updater/
#WORKDIR /opt/freenom_dns_updater
RUN apk add --no-cache zlib openssl-dev binutils py3-pip
RUN pip install freenom-dns-updater
#RUN rm -rf /opt/freenom_dns_updater

# Copy data for add-on
#ENTRYPOINT [ "fdu" ]
#CMD [ "process", "-i", "-c", "-r", "-t", "3600", "/etc/freenom.yml" ]
COPY run.sh /
RUN chmod a+x /run.sh
CMD [ "/run.sh" ]
