ARG BUILD_FROM
ARG BUILD_DATE
# hadolint ignore=DL3006
FROM ${BUILD_FROM} as base

# hadolint ignore=DL3018,DL3059
RUN apk --update add redis curl gettext mariadb-client nginx php82 php82-bcmath php82-common php82-dom php82-fileinfo
# hadolint ignore=DL3018,DL3059
RUN apk --update add php82-fpm php82-gd php82-pecl-memcached php82-mbstring php82-openssl php82-pdo php82-phar php82-json
# hadolint ignore=DL3018,DL3059
RUN apk --update add php82-sodium php82-pdo_mysql php82-session php82-simplexml php82-tokenizer php82-ctype php82-zlib php82-zip php82-xmlwriter tini
RUN mkdir -p /var/www/html /run/nginx /etc/nginx/conf.d/
RUN ln -s /usr/bin/php82 /usr/bin/php

# Build phase of the container
# This is where composer is added and pterodactyl properly setup
FROM base as build
WORKDIR /var/www/html
RUN apk add yarn git
RUN git clone https://github.com/pterodactyl/panel ./ --depth 1 --branch release/v1.10.4
RUN rm -rf .git
RUN chmod -R 755 storage/* bootstrap/cache
RUN find storage -type d > .storage.tmpl
# hadolint ignore=DL4006
RUN curl -sS https://getcomposer.org/installer | php -- --install-dir=/usr/local/bin --filename=composer
RUN cp .env.example .env
RUN composer install --ansi --no-dev --optimize-autoloader
RUN chown -R nginx:nginx *
RUN yarn install --production
RUN yarn add cross-env
RUN yarn run build:production
RUN rm -rf node_modules

# Final Production phase of the controller
# All build requirements get scrapped as to maintain a small image
FROM base as production

WORKDIR /var/www/html

COPY --from=build --chown=nginx:nginx /var/www/html /var/www/html
COPY ./root/ /

# Copy data for add-on
COPY run.sh /
RUN chmod a+x /run.sh
RUN chmod 775 /var/www/html/*
CMD [ "/run.sh" ]

# Labels
LABEL org.opencontainers.image.title="pterodactyl Panel Gameserver - BETA"
LABEL org.opencontainers.image.description="Open-Source Gameserver - Currently not fully working"
LABEL org.opencontainers.image.vendor="FaserF's Home Assistant Add-ons"
LABEL org.opencontainers.image.authors="FaserF <https://github.com/FaserF>"
LABEL org.opencontainers.image.licenses="MIT"
LABEL org.opencontainers.image.url="https://github.com/FaserF/hassio-addons/tree/master/pterodactyl-panel"
LABEL org.opencontainers.image.source="https://github.com/FaserF/hassio-addons/tree/master/pterodactyl-panel"
LABEL org.opencontainers.image.documentation="https://github.com/FaserF/hassio-addons/blob/master/pterodactyl-panel/README.md"
LABEL org.opencontainers.image.created="${BUILD_DATE}"
