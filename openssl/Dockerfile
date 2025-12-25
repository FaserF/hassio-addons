ARG BUILD_FROM=ghcr.io/hassio-addons/base:19.0.0
# hadolint ignore=DL3006
FROM ${BUILD_FROM}
ARG BUILD_DATE

# hadolint ignore=DL3018
RUN apk --no-cache add openssl

# Copy data for add-on
COPY run.sh /
RUN chmod a+x /run.sh

HEALTHCHECK CMD /usr/bin/openssl version || exit 1

CMD [ "/run.sh" ]

# Labels
LABEL org.opencontainers.image.title="OpenSSL"
LABEL org.opencontainers.image.description="Generate self-signed certificates"
LABEL org.opencontainers.image.vendor="FaserF's Home Assistant Add-ons"
LABEL org.opencontainers.image.authors="FaserF <https://github.com/FaserF>"
LABEL org.opencontainers.image.licenses="MIT"
LABEL org.opencontainers.image.url="https://github.com/FaserF/hassio-addons/tree/master/openssl"
LABEL org.opencontainers.image.source="https://github.com/FaserF/hassio-addons/tree/master/openssl"
LABEL org.opencontainers.image.documentation="https://github.com/FaserF/hassio-addons/blob/master/openssl/README.md"
LABEL org.opencontainers.image.created="${BUILD_DATE}"
