ARG BUILD_FROM=ghcr.io/hassio-addons/debian-base:7.5.2
FROM ${BUILD_FROM}

ARG LSB_RELEASE=bookworm

# Install SNClient
RUN curl -s "https://labs.consol.de/repo/stable/RPM-GPG-KEY" -o /etc/apt/auth.conf.d/labs.consol.de-RPM-GPG-KEY
RUN echo "deb [signed-by=/etc/apt/auth.conf.d/labs.consol.de-RPM-GPG-KEY] http://labs.consol.de/repo/testing/debian ${LSB_RELEASE} main" > /etc/apt/sources.list.d/labs-consol-testing.list
RUN apt-get update -y
RUN apt-get install snclient -y
RUN touch /etc/snclient/snclient_local.ini

EXPOSE 8443

# Copy data for add-on
COPY run.sh /
RUN chmod +x /run.sh

CMD [ "/run.sh" ]
