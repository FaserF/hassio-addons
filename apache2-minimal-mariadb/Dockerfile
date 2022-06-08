ARG BUILD_FROM=ghcr.io/hassio-addons/base/amd64:12.0.0
# hadolint ignore=DL3006
FROM ${BUILD_FROM}
ENV LANG C.UTF-8

# Create directory for apache2 to store PID file
RUN mkdir /run/apache2

RUN apk --no-cache add apache2 php81-apache2 libxml2-dev apache2-utils apache2-mod-wsgi apache2-ssl
RUN apk --no-cache add php81 php81-mysqli php81-opcache php81-curl php81-mbstring php8-pecl-mcrypt php81-zip
RUN apk --no-cache add mariadb-client

#Configure Logging
RUN sed -i -r 's@Errorlog .*@Errorlog /dev/stderr@i' /etc/apache2/httpd.conf
RUN echo "Transferlog /dev/stdout" >> /etc/apache2/httpd.conf

# Copy data for add-on
COPY run.sh /
COPY index.html /
RUN chmod a+x /run.sh
RUN chmod a+x /index.html
CMD [ "/run.sh" ]
