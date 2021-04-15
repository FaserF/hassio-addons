ARG BUILD_FROM
FROM $BUILD_FROM
ENV LANG C.UTF-8

# Add alpine edge repo for php8
RUN echo "http://dl-cdn.alpinelinux.org/alpine/edge/testing" >> /etc/apk/repositories

# Create directory for apache2 to store PID file
RUN mkdir /run/apache2

RUN apk update && apk upgrade
RUN apk --no-cache add apache2 php8-apache2 libxml2-dev apache2-utils apache2-mod-wsgi apache2-ssl
RUN apk --no-cache add php8 php8-mysqli php8-opcache php8-curl php8-json php8-mbstring php8-mcrypt php8-zip
RUN apk --no-cache add mariadb-client

# Copy data for add-on
COPY run.sh /
COPY index.html /
RUN chmod a+x /run.sh
RUN chmod a+x /index.html
CMD [ "/run.sh" ]
