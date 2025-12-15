ARG BUILD_FROM=ghcr.io/hassio-addons/base:14.1.0
# hadolint ignore=DL3006
FROM ${BUILD_FROM}

# Setup CoreDNS and Cloudflared
COPY --from=coredns/coredns:latest /coredns /usr/bin/coredns
COPY --from=cloudflare/cloudflared:latest /usr/local/bin/cloudflared /usr/bin/cloudflared

# Install dependencies (if any extra needed beyond base)
RUN apk add --no-cache bind-tools openssl

# Copy Addon run script to S6 services location
COPY run.sh /etc/services.d/shielddns/run
RUN chmod +x /etc/services.d/shielddns/run

# S6-Overlay is the entrypoint in the base image, so we don't set ENTRYPOINT/CMD here.
# /init will start S6, which will start /etc/services.d/shielddns/run
