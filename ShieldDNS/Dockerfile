ARG BUILD_FROM=ghcr.io/hassio-addons/base:14.1.0
# hadolint ignore=DL3006
FROM ${BUILD_FROM}

# Setup CoreDNS and Cloudflared
COPY --from=coredns/coredns:latest /coredns /usr/bin/coredns
COPY --from=cloudflare/cloudflared:latest /usr/local/bin/cloudflared /usr/bin/cloudflared

# Install dependencies (if any extra needed beyond base)
RUN apk add --no-cache bind-tools openssl nginx

# Copy rootfs
COPY rootfs /

# Set execute permissions (just in case)
RUN chmod +x /etc/cont-init.d/*.sh /etc/services.d/*/run