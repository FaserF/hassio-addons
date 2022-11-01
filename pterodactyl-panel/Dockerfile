ARG BUILD_FROM=ghcr.io/hassio-addons/base:12.2.4
# hadolint ignore=DL3006
FROM ${BUILD_FROM}

RUN apk --update add curl gettext mariadb-client nginx php81 php81 php81-bcmath php81-common php81-dom php81-fileinfo \
    php81-fpm php81-gd php81-pecl-memcached php81-mbstring php81-openssl php81-pdo php81-phar php81-json php81-sodium \
    php81-pdo_mysql php81-session php81-simplexml php81-tokenizer php81-ctype php81-zlib php81-zip php81-xmlwriter \
    tini \
    && mkdir -p /var/www/html /run/nginx /etc/nginx/conf.d/

WORKDIR /var/www/html

RUN apk add yarn;

RUN \
    curl -Lo panel.tar.gz https://github.com/pterodactyl/panel/releases/latest/download/panel.tar.gz \
    #tar -xzvf panel.tar.gz; \
    chmod -R 755 storage/* bootstrap/cache; \
    find storage -type d > .storage.tmpl; \
    curl -sS https://getcomposer.org/installer | php -- --install-dir=/usr/local/bin --filename=composer; \
    cp .env.example .env; \
    composer install --ansi --no-dev --optimize-autoloader; \
    chown -R nginx:nginx *; \
    rm -rf panel.tar.gz;

RUN \
    yarn install --production; \
    yarn add cross-env; \
    yarn run build:production; \
    rm -rf node_modules;

# Remove persistent data folders as they will be symlinked further down
RUN rm .env ./storage -rf

COPY ./root/ /

# Copy data for add-on
COPY run.sh /
RUN chmod a+x /run.sh
CMD [ "/run.sh" ]
