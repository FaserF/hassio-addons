ARG BUILD_FROM
# hadolint ignore=DL3006
FROM ${BUILD_FROM}

# Create directory for apache2 to store PID file
RUN mkdir /run/apache2

RUN apk --no-cache add apache2 php84-apache2 libxml2-dev apache2-utils apache2-mod-wsgi apache2-ssl apache2-proxy
RUN apk --no-cache add php84 php84-dev php84-fpm php84-mysqli php84-opcache php84-gd zlib php84-curl php84-phar php84-mbstring php84-zip php84-pdo php84-pdo_mysql php84-iconv php84-dom php84-session php84-intl php84-soap php84-fileinfo php84-xml php84-ctype php84-pecl-xdebug php84-pdo_sqlite php84-tokenizer php84-exif php84-xmlwriter php84-cgi php84-simplexml
RUN apk --no-cache add \
    php84-simplexml \
    php84-gd \
    php84-json \
    php84-imap \
    php84-apcu
RUN apk --no-cache add mosquitto mosquitto-dev
RUN apk --no-cache add mariadb-client
RUN apk --no-cache add ffmpeg

#musl-locales/php-locales
RUN apk add --no-cache cmake make musl-dev gcc gettext-dev libintl
RUN wget https://gitlab.com/rilian-la-te/musl-locales/-/archive/master/musl-locales-master.zip \
    && unzip musl-locales-master.zip \
    && cd musl-locales-master \
    && cmake -DLOCALE_PROFILE=OFF -D CMAKE_INSTALL_PREFIX:PATH=/usr . && make && make install \
    && cd .. && rm -r musl-locales-master

# Install ssh2 extension
#RUN apk --no-cache add libssh2-dev php84-pear zlib-dev build-base
#RUN pecl channel-update pecl.php.net \
#    && pecl install ssh2-1.3.1
#RUN docker-php-ext-enable ssh2
#From here beginning most likely needed
#RUN apk --no-cache add libssh2-dev
#RUN wget -O ssh2.tgz https://pecl.php.net/get/ssh2-1.3.1.tgz \
#    && mkdir ssh2 && tar vxzf ssh2.tgz -C ssh2 --strip-components 1 \
#    && cd ../ssh2 && phpize81 \
#    && ./configure --with-ssh2 --with-php-config=/etc/php84/php.ini \
#    && make && make install \
#    && cd ../ && rm -rf ssh2.tgz ssh2

#Configure Logging
RUN sed -i -r 's@Errorlog .*@Errorlog /dev/stderr@i' /etc/apache2/httpd.conf
RUN echo "Transferlog /dev/stdout" >> /etc/apache2/httpd.conf

# Copy data for add-on
COPY run.sh /
COPY index.html /
RUN chmod a+x /run.sh
RUN chmod a+x /index.html
CMD [ "/run.sh" ]
