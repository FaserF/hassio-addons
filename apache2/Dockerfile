ARG BUILD_FROM=ghcr.io/hassio-addons/base/amd64:12.0.0
# hadolint ignore=DL3006
FROM ${BUILD_FROM}
ENV LANG C.UTF-8

# Create directory for apache2 to store PID file
RUN mkdir /run/apache2

RUN apk --no-cache add apache2 php81-apache2 libxml2-dev apache2-utils apache2-mod-wsgi apache2-ssl
RUN apk --no-cache add php81 php81-dev php81-fpm php81-mysqli php81-opcache php81-gd zlib php81-curl php81-phar php81-mbstring php8-pecl-mcrypt php81-zip php81-pdo php81-pdo_mysql php81-iconv php81-dom php81-session php81-intl php81-soap php81-fileinfo php81-xml php81-ctype
RUN apk --no-cache add mosquitto mosquitto-dev
RUN apk --no-cache add mariadb-client

#musl-locales/php-locales
RUN apk add --no-cache cmake make musl-dev gcc gettext-dev libintl 
RUN wget https://gitlab.com/rilian-la-te/musl-locales/-/archive/master/musl-locales-master.zip \
    && unzip musl-locales-master.zip \
      && cd musl-locales-master \
      && cmake -DLOCALE_PROFILE=OFF -D CMAKE_INSTALL_PREFIX:PATH=/usr . && make && make install \
      && cd .. && rm -r musl-locales-master

#Configure Logging
RUN sed -i -r 's@Errorlog .*@Errorlog /dev/stderr@i' /etc/apache2/httpd.conf
RUN echo "Transferlog /dev/stdout" >> /etc/apache2/httpd.conf

# Copy data for add-on
COPY run.sh /
COPY index.html /
RUN chmod a+x /run.sh
RUN chmod a+x /index.html
CMD [ "/run.sh" ]
