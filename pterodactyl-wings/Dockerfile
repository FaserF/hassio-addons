ARG BUILD_FROM
# hadolint ignore=DL3006
FROM ${BUILD_FROM}

RUN \
# hadolint ignore=DL3018
apk add --no-cache ca-certificates curl tini tzdata; \
mkdir -p /etc/pterodactyl /var/log/pterodactyl /tmp/pterodactyl

#RUN curl -L -o /usr/local/bin/wings "https://github.com/pterodactyl/wings/releases/latest/download/wings_linux_$([[ "$(uname -m)" == "x86_64" ]] && echo "amd64" || echo "arm64")" \
RUN curl -L -o /usr/local/bin/wings "https://github.com/pterodactyl/wings/releases/latest/download/wings_linux_amd64" \
&& chmod u+x /usr/local/bin/wings

# Copy data for add-on
COPY run.sh /
RUN chmod a+x /run.sh
CMD [ "/run.sh" ]

# Labels
LABEL org.opencontainers.image.title="pterodactyl Wings Gameserver"
LABEL org.opencontainers.image.description="Open Source Gameserver"
LABEL org.opencontainers.image.vendor="FaserF's Home Assistant Add-ons"
LABEL org.opencontainers.image.authors="FaserF <https://github.com/FaserF>"
LABEL org.opencontainers.image.licenses="MIT"
LABEL org.opencontainers.image.url="https://github.com/FaserF/hassio-addons/tree/master/pterodactyl-wings"
LABEL org.opencontainers.image.source="https://github.com/FaserF/hassio-addons/tree/master/pterodactyl-wings"
LABEL org.opencontainers.image.documentation="https://github.com/FaserF/hassio-addons/tree/master/pterodactyl-wings/blob/master/pterodactyl-wings/README.md"
LABEL org.opencontainers.image.created="2025-12-24"
