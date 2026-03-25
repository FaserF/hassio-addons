# hadolint ignore=DL3006
FROM ${BUILD_FROM}
ARG BUILD_DATE="1970-01-01T00:00:00Z"

# Software versions
ENV COREDNS_VERSION="1.14.2"
ENV APP_VERSION="2.4.0"
ENV APP_NAME="ShieldDNS"
ENV APP_SLUG="shielddns"
ENV APP_UNSUPPORTED="false"

# Setup directories
RUN mkdir -p /var/www/admin /var/www/html /run/nginx /etc/services.d/shielddns /etc/shielddns

# Install core dependencies and ShieldDNS assets
# We fetch pre-compiled binaries and assets from the ShieldDNS releases to ensure
# consistency and performance.
RUN set -x \
    && curl -L -o /usr/bin/coredns "https://github.com/coredns/coredns/releases/download/v${COREDNS_VERSION}/coredns_${COREDNS_VERSION}_linux_amd64.tgz" \
    && tar -xzf /usr/bin/coredns -C /usr/bin/ \
    && rm /usr/bin/coredns \
    && curl -L -o /usr/bin/shielddns-admin "https://github.com/FaserF/ShieldDNS/releases/download/v${APP_VERSION}/shielddns-admin-linux-amd64" \
    && chmod +x /usr/bin/shielddns-admin \
    && curl -L -o /tmp/www.tar.gz "https://github.com/FaserF/ShieldDNS/releases/download/v${APP_VERSION}/www.tar.gz" \
    && tar -xzf /tmp/www.tar.gz -C /var/www/admin \
    && rm /tmp/www.tar.gz

# We add netcat-openbsd for port checking (nc) and net-tools for netstat
# hadolint ignore=DL3018
RUN apk add --no-cache -u libssl3 libcrypto3 bind-tools openssl nginx netcat-openbsd net-tools dos2unix curl

# Copy Web Assets
COPY www/index.html /var/www/html/index.html
COPY www/logo.png /var/www/html/logo.png

# Copy Addon run script to S6 services directory
COPY run.sh /etc/services.d/shielddns/run
RUN dos2unix /etc/services.d/shielddns/run && chmod +x /etc/services.d/shielddns/run

# Healthcheck
HEALTHCHECK --interval=30s --timeout=10s --retries=3 --start-period=60s \
    CMD curl -fS http://localhost:8080/api/stats || exit 1

# Labels
LABEL org.opencontainers.image.title="ShieldDNS"
LABEL org.opencontainers.image.description="High-performance DoT proxy for AdGuard Home"
LABEL org.opencontainers.image.vendor="FaserF's Home Assistant Apps"
LABEL org.opencontainers.image.authors="FaserF <https://github.com/FaserF>"
LABEL org.opencontainers.image.licenses="MIT"
LABEL org.opencontainers.image.url="https://github.com/FaserF/hassio-addons/tree/master/ShieldDNS"
LABEL org.opencontainers.image.source="https://github.com/FaserF/hassio-addons/tree/master/ShieldDNS"
LABEL org.opencontainers.image.documentation="https://github.com/FaserF/hassio-addons/blob/master/ShieldDNS/README.md"
LABEL org.opencontainers.image.created="${BUILD_DATE}"
