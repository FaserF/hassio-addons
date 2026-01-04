ARG BUILD_FROM=ghcr.io/hassio-addons/base:19.0.0
# hadolint ignore=DL3006
FROM ${BUILD_FROM}
ENV PIP_BREAK_SYSTEM_PACKAGES=1
ARG BUILD_DATE="1970-01-01T00:00:00Z"
# CR-Skip-PythonBaseCheck

# Create directory for FDU
#RUN mkdir -p '/opt/freenom_dns_updater'
#COPY . /opt/freenom_dns_updater/
#WORKDIR /opt/freenom_dns_updater
# hadolint ignore=DL3018,DL3013,DL3042

# Addon metadata (injected by CI)
ENV ADDON_VERSION="2.0.0"
ENV ADDON_NAME="Freenom-dns-updater (Unsupported)"
ENV ADDON_SLUG="freenom-dns-updater"
ENV ADDON_UNSUPPORTED="true"

RUN apk add --no-cache zlib openssl-dev binutils python3 py3-pip && \
    pip install --no-cache-dir freenom-dns-updater==1.2.9
#RUN rm -rf /opt/freenom_dns_updater

# Copy data for add-on
#ENTRYPOINT [ "fdu" ]
#CMD [ "process", "-i", "-c", "-r", "-t", "3600", "/etc/freenom.yml" ]
COPY run.sh /
RUN chmod a+x /run.sh
CMD [ "/run.sh" ]

# Health check - verify main process is running (use exact path)
HEALTHCHECK --interval=300s --timeout=10s --start-period=30s --retries=3 \
    CMD pgrep -f "^/bin/bash /run.sh" >/dev/null || pgrep -x "bashio" >/dev/null || exit 1

# Labels
LABEL org.opencontainers.image.title="Freenom-dns-updater"
LABEL org.opencontainers.image.description="Freenom Registrar Domain Management - update dns records, Manage (add/update/remove) a domain's dns record, auto renew domains and more. (Unsupported)"
LABEL org.opencontainers.image.vendor="FaserF's Home Assistant Add-ons"
LABEL org.opencontainers.image.authors="FaserF <https://github.com/FaserF>"
LABEL org.opencontainers.image.licenses="MIT"
LABEL org.opencontainers.image.url="https://github.com/FaserF/hassio-addons/tree/master/.unsupported/freenom-dns-updater"
LABEL org.opencontainers.image.source="https://github.com/FaserF/hassio-addons/tree/master/.unsupported/freenom-dns-updater"
LABEL org.opencontainers.image.documentation="https://github.com/FaserF/hassio-addons/blob/master/.unsupported/freenom-dns-updater/README.md"
LABEL org.opencontainers.image.created="${BUILD_DATE}"
