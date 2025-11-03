ARG BUILD_FROM
# hadolint ignore=DL3006
FROM ${BUILD_FROM}

# Create directory for apache2 to store PID file
RUN mkdir /run/apache2

RUN apk --no-cache add apache2 php84-apache2 libxml2-dev apache2-utils apache2-mod-wsgi apache2-ssl
RUN apk --no-cache add php84 php84-mysqli php84-opcache php84-curl php84-mbstring php84-zip
RUN apk --no-cache add mariadb-client

#Configure Logging
RUN sed -i -r 's@Errorlog .*@Errorlog /dev/stderr@i' /etc/apache2/httpd.conf
RUN echo "Transferlog /dev/stdout" >> /etc/apache2/httpd.conf

# Copy data for add-on
COPY run.sh /
COPY index.html /
RUN chmod a+x /run.sh
CMD [ "/run.sh" ]
