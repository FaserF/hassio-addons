ARG BUILD_FROM
FROM $BUILD_FROM
ENV LANG C.UTF-8

# Add alpine edge repo for php8
RUN echo "http://dl-cdn.alpinelinux.org/alpine/edge/testing" >> /etc/apk/repositories

# Create directory for apache2 to store PID file
RUN mkdir /run/apache2

RUN apk update && apk upgrade
RUN apk --no-cache add apache2 php8-apache2 libxml2-dev apache2-utils apache2-mod-wsgi apache2-ssl
RUN apk --no-cache add php8 php8-dev php8-fpm php8-mysqli php8-opcache php8-gd php8-zlib php8-curl php8-phar php8-json php8-mbstring php8-mcrypt php8-zip php8-pdo php8-pdo_mysql php8-iconv php8-dom php8-session php8-intl php8-soap php8-fileinfo php8-xml mosquitto mosquitto-dev
RUN apk --no-cache add mariadb-client

#Add php locales
ENV MUSL_LOCALE_DEPS cmake make musl-dev gcc gettext-dev libintl 
ENV MUSL_LOCPATH /usr/share/i18n/locales/musl

RUN apk add --no-cache \
    $MUSL_LOCALE_DEPS \
    && wget https://gitlab.com/rilian-la-te/musl-locales/-/archive/master/musl-locales-master.zip \
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

# Copy data for add-on
COPY run.sh /
COPY index.html /
RUN chmod a+x /run.sh
RUN chmod a+x /index.html
CMD [ "/run.sh" ]
