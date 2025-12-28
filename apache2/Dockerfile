ARG BUILD_FROM=ghcr.io/hassio-addons/base:19.0.0
# hadolint ignore=DL3006
FROM ${BUILD_FROM}
ARG BUILD_DATE="1970-01-01T00:00:00Z"

# Create directory for apache2 to store PID file
# Create directory for apache2 to store PID file and install dependencies
# hadolint ignore=DL3018,DL3003,DL3047
RUN mkdir /run/apache2 \
    && apk --no-cache add \
    # Excluded due to low usage but high increase of image size: libxml2-dev, php84-dev, php84-pecl-xdebug, mosquitto-dev
    apache2 \
    curl \
    php84-apache2 \
    apache2-utils \
    apache2-mod-wsgi \
    apache2-ssl \
    apache2-proxy \
    php84 \
    php84-fpm \
    php84-mysqli \
    php84-opcache \
    php84-gd \
    zlib \
    php84-curl \
    php84-phar \
    php84-mbstring \
    php84-zip \
    php84-pdo \
    php84-pdo_mysql \
    php84-iconv \
    php84-dom \
    php84-session \
    php84-intl \
    php84-soap \
    php84-fileinfo \
    php84-xml \

    php84-ctype \
    php84-pdo_sqlite \
    php84-tokenizer \
    php84-exif \
    php84-xmlwriter \
    php84-cgi \
    php84-simplexml \
    php84-sockets \
    php84-json \
    php84-imap \
    php84-apcu \
    mosquitto \
    mariadb-client \
    ffmpeg \
    cmake make musl-dev gcc gettext-dev libintl libxml2 \
    && wget https://gitlab.com/rilian-la-te/musl-locales/-/archive/master/musl-locales-master.zip \
    && unzip musl-locales-master.zip \
    && cd musl-locales-master \
    && cmake -DLOCALE_PROFILE=OFF -D CMAKE_INSTALL_PREFIX:PATH=/usr . && make && make install \
    && cd .. && rm -r musl-locales-master \
    && apk del --no-cache cmake make gcc gettext-dev libintl

# Configure Logging
RUN sed -i -r 's@Errorlog .*@Errorlog /dev/stderr@i' /etc/apache2/httpd.conf \
    && echo "Transferlog /dev/stdout" >> /etc/apache2/httpd.conf

# Copy data for add-on
COPY rootfs /
COPY index.html /

RUN chmod +x /etc/cont-init.d/apache2.sh /etc/services.d/apache2/run

# Health check
HEALTHCHECK --interval=60s --timeout=15s --retries=3 CMD curl --fail http://127.0.0.1:80 || exit 1

# Labels
LABEL org.opencontainers.image.title="Apache2"
LABEL org.opencontainers.image.description="Open Source Webserver with PHP and MariaDB."
LABEL org.opencontainers.image.vendor="FaserF's Home Assistant Add-ons"
LABEL org.opencontainers.image.authors="FaserF <https://github.com/FaserF>"
LABEL org.opencontainers.image.licenses="MIT"
LABEL org.opencontainers.image.url="https://github.com/FaserF/hassio-addons/tree/master/apache2"
LABEL org.opencontainers.image.source="https://github.com/FaserF/hassio-addons/tree/master/apache2"
LABEL org.opencontainers.image.documentation="https://github.com/FaserF/hassio-addons/blob/master/apache2/README.md"
LABEL org.opencontainers.image.created="${BUILD_DATE}"
