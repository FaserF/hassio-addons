ARG BUILD_FROM=ghcr.io/hassio-addons/base:20.0.1
# hadolint ignore=DL3006

# --- STAGE 1: CORE DNS BINARY ---
FROM --platform=$BUILDPLATFORM alpine:3.21 AS binary
ARG TARGETARCH
# renovate: datasource=github-releases depName=coredns/coredns
ARG COREDNS_VERSION="1.14.2"
RUN apk add --no-cache curl \
    && case "${TARGETARCH}" in \
        "amd64") \
            ARCH="amd64" ;; \
        "arm64") \
            ARCH="arm64" ;; \
        *) \
            echo "Unsupported architecture: ${TARGETARCH}"; exit 1 ;; \
    esac \
    && curl -L "https://github.com/coredns/coredns/releases/download/v${COREDNS_VERSION}/coredns_${COREDNS_VERSION}_linux_${ARCH}.tgz" -o coredns.tgz \
    && tar -xzf coredns.tgz \
    && rm coredns.tgz

# --- STAGE 2: BUILD SHIELDDNS ADMIN ---
FROM --platform=$BUILDPLATFORM golang:1.24-alpine AS admin-build
ARG TARGETARCH
# renovate: datasource=github-releases depName=FaserF/ShieldDNS
ARG SHIELDDNS_VERSION="1.4.0"
WORKDIR /app
RUN apk add --no-cache curl \
    && curl -L "https://github.com/FaserF/ShieldDNS/archive/refs/tags/v${SHIELDDNS_VERSION}.tar.gz" -o source.tar.gz \
    && tar -xzf source.tar.gz --strip-components=1 \
    && cd admin \
    && go mod download \
    && GOOS=linux GOARCH=$TARGETARCH go build -o shielddns-admin .

# --- STAGE 3: RUNTIME IMAGE ---
FROM ${BUILD_FROM}
ARG BUILD_DATE="1970-01-01T00:00:00Z"

# App metadata (Single set, consolidated)
ENV APP_VERSION="2.4.0"
ENV APP_NAME="ShieldDNS"
ENV APP_SLUG="shielddns"
ENV APP_UNSUPPORTED="false"

# Setup directories
RUN mkdir -p /var/www/admin /var/www/html /run/nginx /etc/services.d/shielddns /etc/shielddns

# Copy pre-compiled binaries and assets from build stages
COPY --from=binary /coredns /usr/bin/coredns
COPY --from=admin-build /app/admin/shielddns-admin /usr/bin/shielddns-admin
COPY --from=admin-build /app/admin/www /var/www/admin

# Install dependencies
# hadolint ignore=DL3018
RUN apk add --no-cache -u \
    libssl3 \
    libcrypto3 \
    bind-tools \
    openssl \
    nginx \
    netcat-openbsd \
    net-tools \
    dos2unix \
    curl \
    jq \
    ca-certificates

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
