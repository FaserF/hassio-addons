ARG BUILD_FROM
ARG BUILD_DATE
# hadolint ignore=DL3006
FROM ${BUILD_FROM}
ARG BUILD_DATE

# Create directory for apache2 to store PID file
# Create directory for apache2 to store PID file and install dependencies
# hadolint ignore=DL3018
RUN mkdir /run/apache2 \
    && apk --no-cache add apache2 libxml2-dev apache2-utils apache2-mod-wsgi apache2-ssl \
    && sed -i -r 's@Errorlog .*@Errorlog /dev/stderr@i' /etc/apache2/httpd.conf \
    && echo "Transferlog /dev/stdout" >> /etc/apache2/httpd.conf

# Copy data for add-on
COPY run.sh /
COPY index.html /
RUN chmod a+x /run.sh
CMD [ "/run.sh" ]

# Labels
LABEL org.opencontainers.image.title="Apache2 Minimal"
LABEL org.opencontainers.image.description="Open Source Webserver without PHP and minimal extra modules."
LABEL org.opencontainers.image.vendor="FaserF's Home Assistant Add-ons"
LABEL org.opencontainers.image.authors="FaserF <https://github.com/FaserF>"
LABEL org.opencontainers.image.licenses="MIT"
LABEL org.opencontainers.image.url="https://github.com/FaserF/hassio-addons/tree/master/apache2-minimal"
LABEL org.opencontainers.image.source="https://github.com/FaserF/hassio-addons/tree/master/apache2-minimal"
LABEL org.opencontainers.image.documentation="https://github.com/FaserF/hassio-addons/blob/master/apache2-minimal/README.md"
LABEL org.opencontainers.image.created="${BUILD_DATE}"
