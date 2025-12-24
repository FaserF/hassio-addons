ARG BUILD_FROM
# hadolint ignore=DL3006
FROM ${BUILD_FROM}

# Create directory for apache2 to store PID file
RUN mkdir /run/apache2

# hadolint ignore=DL3018
RUN apk --no-cache add \
    apache2 \
    php84-apache2 \
    libxml2-dev \
    apache2-utils \
    apache2-mod-wsgi \
    apache2-ssl \
    php84 \
    php84-mysqli \
    php84-opcache \
    php84-curl \
    php84-mbstring \
    php84-zip \
    mariadb-client

#Configure Logging
RUN sed -i -r 's@Errorlog .*@Errorlog /dev/stderr@i' /etc/apache2/httpd.conf
RUN echo "Transferlog /dev/stdout" >> /etc/apache2/httpd.conf

# Copy data for add-on
COPY run.sh /
COPY index.html /
RUN chmod a+x /run.sh
CMD [ "/run.sh" ]

# Labels
LABEL org.opencontainers.image.title="Apache2 Minimal with MariaDB Client"
LABEL org.opencontainers.image.description="Open Source Webserver with MariaDB Client and some PHP Modules."
LABEL org.opencontainers.image.vendor="FaserF's Home Assistant Add-ons"
LABEL org.opencontainers.image.authors="FaserF <https://github.com/FaserF>"
LABEL org.opencontainers.image.licenses="MIT"
LABEL org.opencontainers.image.url="https://github.com/FaserF/hassio-addons/tree/master/apache2-minimal-mariadb"
LABEL org.opencontainers.image.source="https://github.com/FaserF/hassio-addons/tree/master/apache2-minimal-mariadb"
LABEL org.opencontainers.image.documentation="https://github.com/FaserF/hassio-addons/tree/master/apache2-minimal-mariadb/blob/master/apache2-minimal-mariadb/README.md"
LABEL org.opencontainers.image.created="2025-12-24"
