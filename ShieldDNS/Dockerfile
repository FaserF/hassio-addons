ARG BUILD_FROM=ghcr.io/hassio-addons/base:19.0.0

# Define external images as build stages (fixes DL3022)
# hadolint ignore=DL3007
FROM coredns/coredns:1.14.0 AS coredns

# hadolint ignore=DL3007
FROM cloudflare/cloudflared:2025.11.1 AS cloudflared

# hadolint ignore=DL3006
FROM ${BUILD_FROM}
ARG BUILD_DATE="1970-01-01T00:00:00Z"

# Software versions (from image tags above)
ENV COREDNS_VERSION="1.14.0"
ENV CLOUDFLARED_VERSION="2025.11.1"

# Setup CoreDNS and Cloudflared

# Addon metadata (injected by CI)
ENV ADDON_VERSION="2.1.0"
ENV ADDON_NAME="ShieldDNS"
ENV ADDON_SLUG="shielddns"
ENV ADDON_UNSUPPORTED="false"

COPY --from=coredns /coredns /usr/bin/coredns
COPY --from=cloudflared /usr/local/bin/cloudflared /usr/bin/cloudflared

# We add netcat-openbsd for port checking (nc) and net-tools for netstat
# hadolint ignore=DL3018
RUN apk add --no-cache bind-tools openssl nginx netcat-openbsd net-tools dos2unix curl \
    && mkdir -p /var/www/html /run/nginx /etc/services.d/shielddns

# Copy Web Assets
COPY www/index.html /var/www/html/index.html
COPY www/logo.png /var/www/html/logo.png

# Copy Addon run script to S6 services directory
COPY run.sh /etc/services.d/shielddns/run
RUN dos2unix /etc/services.d/shielddns/run && chmod +x /etc/services.d/shielddns/run

# Healthcheck
HEALTHCHECK --interval=30s --timeout=10s --retries=3 --start-period=60s \
    CMD wget -q --spider http://localhost:8080/health || exit 1

# Labels
LABEL org.opencontainers.image.title="ShieldDNS"
LABEL org.opencontainers.image.description="High-performance DoT proxy for AdGuard Home"
LABEL org.opencontainers.image.vendor="FaserF's Home Assistant Add-ons"
LABEL org.opencontainers.image.authors="FaserF <https://github.com/FaserF>"
LABEL org.opencontainers.image.licenses="MIT"
LABEL org.opencontainers.image.url="https://github.com/FaserF/hassio-addons/tree/master/ShieldDNS"
LABEL org.opencontainers.image.source="https://github.com/FaserF/hassio-addons/tree/master/ShieldDNS"
LABEL org.opencontainers.image.documentation="https://github.com/FaserF/hassio-addons/blob/master/ShieldDNS/README.md"
LABEL org.opencontainers.image.created="${BUILD_DATE}"
