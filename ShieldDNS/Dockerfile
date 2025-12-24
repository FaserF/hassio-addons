ARG BUILD_FROM=ghcr.io/hassio-addons/base:19.0.0
# hadolint ignore=DL3006
FROM ${BUILD_FROM}

# Setup CoreDNS and Cloudflared
COPY --from=coredns/coredns:latest /coredns /usr/bin/coredns
COPY --from=cloudflare/cloudflared:latest /usr/local/bin/cloudflared /usr/bin/cloudflared

# We add netcat-openbsd for port checking (nc) and net-tools for netstat
# hadolint ignore=DL3018
RUN apk add --no-cache bind-tools openssl nginx netcat-openbsd net-tools dos2unix

# Create web root and required directories
RUN mkdir -p /var/www/html /run/nginx

# Copy Web Assets
COPY www/index.html /var/www/html/index.html
COPY www/logo.png /var/www/html/logo.png

# Copy Addon run script to S6 services directory
RUN mkdir -p /etc/services.d/shielddns
COPY run.sh /etc/services.d/shielddns/run
RUN dos2unix /etc/services.d/shielddns/run && chmod +x /etc/services.d/shielddns/run

# Labels
LABEL org.opencontainers.image.title="ShieldDNS"
LABEL org.opencontainers.image.description="High-performance DoT proxy for AdGuard Home"
LABEL org.opencontainers.image.vendor="FaserF's Home Assistant Add-ons"
LABEL org.opencontainers.image.authors="FaserF <https://github.com/FaserF>"
LABEL org.opencontainers.image.licenses="MIT"
LABEL org.opencontainers.image.url="https://github.com/FaserF/hassio-addons/tree/master/ShieldDNS"
LABEL org.opencontainers.image.source="https://github.com/FaserF/hassio-addons/tree/master/ShieldDNS"
LABEL org.opencontainers.image.documentation="https://github.com/FaserF/hassio-addons/blob/master/ShieldDNS/README.md"
LABEL org.opencontainers.image.created="2025-12-24"
