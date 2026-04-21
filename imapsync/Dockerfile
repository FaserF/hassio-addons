ARG BUILD_FROM=ghcr.io/hassio-addons/base:20.1.0
# hadolint ignore=DL3006
FROM ${BUILD_FROM}
ARG BUILD_DATE="1970-01-01T00:00:00Z"

# Set shell with pipefail for Alpine
SHELL ["/bin/ash", "-o", "pipefail", "-c"]

# Install Perl and imapsync dependencies natively
# hadolint ignore=DL3018
ARG IMAPSYNC_VERSION=2.229

# App metadata (injected by CI)
ENV APP_VERSION="0.3.1"
ENV APP_NAME="Imapsync"
ENV APP_SLUG="imapsync"
ENV APP_UNSUPPORTED="false"

RUN \
    echo "http://dl-cdn.alpinelinux.org/alpine/v3.23/main" > /etc/apk/repositories \
    && echo "http://dl-cdn.alpinelinux.org/alpine/v3.23/community" >> /etc/apk/repositories \
    && apk add --no-cache musl musl-dev \
    && apk upgrade --no-cache --available \
    && apk add --no-cache \
    expect \
    perl \
    perl-cgi \
    perl-crypt-openssl-rsa \
    perl-data-uniqid \
    perl-date-manip \
    perl-digest-hmac \
    perl-doc \
    perl-email-address \
    perl-encode-imaputf7 \
    perl-file-copy-recursive \
    perl-file-tail \
    perl-io-socket-inet6 \
    perl-io-socket-ssl \
    perl-io-tee \
    perl-json \
    perl-json-webtoken \
    perl-lwp-protocol-https \
    perl-mail-imapclient \
    perl-mime-base64 \
    perl-net-dns \
    perl-net-ssleay \
    perl-ntlm \
    perl-proc-processtable \
    perl-readonly \
    perl-regexp-common \
    perl-sys-meminfo \
    perl-term-readkey \
    perl-unicode-string \
    perl-uri \
    curl \
    jq \
    procps \
    && curl -L -o /usr/local/bin/imapsync "https://raw.githubusercontent.com/imapsync/imapsync/imapsync-${IMAPSYNC_VERSION}/imapsync" \
    && chmod +x /usr/local/bin/imapsync

# Copy data for add-on
COPY rootfs /

# Make run script executable
RUN chmod +x /etc/s6-overlay/s6-rc.d/imapsync/run

# Health check
HEALTHCHECK --interval=60s --timeout=15s --retries=3 CMD /usr/local/bin/imapsync --version || exit 1

# Labels
LABEL org.opencontainers.image.title="Imapsync"
LABEL org.opencontainers.image.description="Sync IMAP accounts easily and reliably."
LABEL org.opencontainers.image.vendor="FaserF's Home Assistant Apps"
LABEL org.opencontainers.image.authors="FaserF <https://github.com/FaserF>"
LABEL org.opencontainers.image.licenses="MIT"
LABEL org.opencontainers.image.url="https://github.com/FaserF/hassio-addons/tree/master/imapsync"
LABEL org.opencontainers.image.source="https://github.com/FaserF/hassio-addons/tree/master/imapsync"
LABEL org.opencontainers.image.documentation="https://github.com/FaserF/hassio-addons/blob/master/imapsync/README.md"
LABEL org.opencontainers.image.created="${BUILD_DATE}"
