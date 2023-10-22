ARG BUILD_FROM=ghcr.io/hassio-addons/base:14.3.0
# hadolint ignore=DL3006
FROM ${BUILD_FROM}

RUN \
apk add --no-cache ca-certificates curl tini tzdata; \
mkdir -p /etc/pterodactyl /var/log/pterodactyl /tmp/pterodactyl 

#RUN curl -L -o /usr/local/bin/wings "https://github.com/pterodactyl/wings/releases/latest/download/wings_linux_$([[ "$(uname -m)" == "x86_64" ]] && echo "amd64" || echo "arm64")" \
RUN curl -L -o /usr/local/bin/wings "https://github.com/pterodactyl/wings/releases/latest/download/wings_linux_amd64" \
&& chmod u+x /usr/local/bin/wings

# Copy data for add-on
COPY run.sh /
RUN chmod a+x /run.sh
CMD [ "/run.sh" ]
