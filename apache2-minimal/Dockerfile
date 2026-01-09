ARG BUILD_FROM=ghcr.io/hassio-addons/base:19.0.0
# hadolint ignore=DL3006
FROM ${BUILD_FROM}
ARG BUILD_DATE="1970-01-01T00:00:00Z"

# Create directory for apache2 to store PID file and install dependencies
# hadolint ignore=DL3018

# Addon metadata (injected by CI)
ENV ADDON_VERSION="3.1.0"
ENV ADDON_NAME="Apache2 Minimal"
ENV ADDON_SLUG="apache2-minimal"
ENV ADDON_UNSUPPORTED="false"

RUN mkdir /run/apache2 \
    && apk --no-cache add \
        apache2 \
        libxml2-dev \
        apache2-utils \
        apache2-mod-wsgi \
        apache2-ssl \
        curl \
        jq \
    && addgroup -S www-data || true \
    && adduser -S -G www-data www-data || true \
    && sed -i -r 's@Errorlog .*@Errorlog /dev/stderr@i' /etc/apache2/httpd.conf \
    && echo "Transferlog /dev/stdout" >> /etc/apache2/httpd.conf

# Copy data for add-on
COPY rootfs /
COPY index.html /

RUN chmod +x /etc/cont-init.d/apache2.sh /etc/services.d/apache2/run

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl --fail http://127.0.0.1:80 || exit 1

# Labels
LABEL org.opencontainers.image.title="Apache2 Minimal"
LABEL org.opencontainers.image.description="Open Source Webserver without PHP and minimal extra modules."
LABEL org.opencontainers.image.vendor="FaserF's Home Assistant Add-ons"
LABEL org.opencontainers.image.authors="FaserF <https://github.com/FaserF>"
LABEL org.opencontainers.image.licenses="MIT"
LABEL org.opencontainers.image.url="https://github.com/FaserF/hassio-addons/tree/master/apache2-minimal"
LABEL org.opencontainers.image.source="https://github.com/FaserF/hassio-addons/tree/master/apache2-minimal"
LABEL org.opencontainers.image.documentation="https://github.com/FaserF/hassio-addons/blob/master/apache2-minimal/README.md"
LABEL org.opencontainers.image.created="${BUILD_DATE}"
