ARG BUILD_FROM=ghcr.io/hassio-addons/base:14.1.0
# hadolint ignore=DL3006
FROM ${BUILD_FROM}

# Setup CoreDNS and Cloudflared
COPY --from=coredns/coredns:latest /coredns /usr/bin/coredns
COPY --from=cloudflare/cloudflared:latest /usr/local/bin/cloudflared /usr/bin/cloudflared

# Install dependencies (if any extra needed beyond base)
RUN apk add --no-cache bind-tools openssl nginx

# Create web root and required directories
RUN mkdir -p /var/www/html /run/nginx

# Copy Web Assets
COPY www/index.html /var/www/html/index.html
COPY www/logo.png /var/www/html/logo.png

# Copy Addon run script to S6 services directory
# We move this to services.d to allow S6 to supervise it properly
# preventing the "s6-overlay-suexec: fatal: can only run as pid 1" error
RUN mkdir -p /etc/services.d/shielddns
COPY run.sh /etc/services.d/shielddns/run
RUN chmod +x /etc/services.d/shielddns/run