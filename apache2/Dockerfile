ARG BUILD_FROM=ghcr.io/hassio-addons/base/amd64:10.1.0
# hadolint ignore=DL3006
FROM ${BUILD_FROM}
ENV LANG C.UTF-8

# Create directory for apache2 to store PID file
RUN mkdir /run/apache2

RUN apk --no-cache add apache2 php7-apache2 libxml2-dev apache2-utils apache2-mod-wsgi apache2-ssl
RUN apk --no-cache add php7 php7-dev php7-fpm php7-mysqli php7-opcache php7-gd php7-zlib php7-curl php7-phar php7-json php7-mbstring php7-mcrypt php7-zip php7-pdo php7-pdo_mysql php7-iconv php7-dom php7-session php7-intl php7-soap php7-fileinfo php7-xml php7-ctype
RUN apk --no-cache add mosquitto mosquitto-dev
RUN apk --no-cache add mariadb-client

#musl-locales/php7-locales
RUN apk add --no-cache cmake make musl-dev gcc gettext-dev libintl 
RUN wget https://gitlab.com/rilian-la-te/musl-locales/-/archive/master/musl-locales-master.zip \
    && unzip musl-locales-master.zip \
      && cd musl-locales-master \
      && cmake -DLOCALE_PROFILE=OFF -D CMAKE_INSTALL_PREFIX:PATH=/usr . && make && make install \
      && cd .. && rm -r musl-locales-master

#Mosquitto-PHP
RUN wget https://github.com/mgdm/Mosquitto-PHP/archive/refs/heads/master.zip \
    && unzip master.zip \
      && cd Mosquitto-PHP-master \
      && phpize \
      && ./configure \
      && make \
      && make install \
      && cd .. && rm -r Mosquitto-PHP-master

#Configure Logging
RUN sed -i -r 's@Errorlog .*@Errorlog /dev/stderr@i' /etc/apache2/httpd.conf
RUN echo "Transferlog /dev/stdout" >> /etc/apache2/httpd.conf

# Copy data for add-on
COPY run.sh /
COPY index.html /
RUN chmod a+x /run.sh
RUN chmod a+x /index.html
CMD [ "/run.sh" ]
