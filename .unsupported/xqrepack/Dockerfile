ARG BUILD_FROM=ghcr.io/hassio-addons/base:19.0.0
# hadolint ignore=DL3006
FROM ${BUILD_FROM}
ARG BUILD_DATE="unknown"

# CR-Skip-PythonBaseCheck
# Use virtual environment for clean package isolation (PEP 668 compliant)
ENV VIRTUAL_ENV=/usr/local/venv
ENV PATH="$VIRTUAL_ENV/bin:$PATH"

# Pin scripts to specific commit for reproducible builds: https://github.com/geekman/xqrepack
ARG XQREPACK_RELEASE="v1.1"

# hadolint ignore=DL3018,DL3013,DL3042

# Addon metadata (injected by CI)
ENV ADDON_VERSION="2.0.0"
ENV ADDON_NAME="xqrepack (Unsupported)"
ENV ADDON_SLUG="xqrepack"
ENV ADDON_UNSUPPORTED="true"

RUN apk add --no-cache \
    wget lzo-dev mtd-utils-ubi squashfs-tools fakeroot make g++ coreutils python3 python3-dev py3-pip && \
    python3 -m venv $VIRTUAL_ENV && \
    pip install --no-cache-dir python-lzo ubi_reader && \
    mkdir /xqrepack && \
    wget -q -O /xqrepack/repack-squashfs.sh "https://raw.githubusercontent.com/geekman/xqrepack/${XQREPACK_RELEASE}/repack-squashfs.sh" && \
    wget -q -O /xqrepack/ubinize.sh "https://raw.githubusercontent.com/geekman/xqrepack/${XQREPACK_RELEASE}/ubinize.sh" && \
    echo "2bbc5b552519dda4cde9c2b65728ac049836b2a1c000f2a87112d346ea1be615  /xqrepack/repack-squashfs.sh" > /xqrepack/checksums.txt && \
    echo "0fc2d057545ebf58d79eb680c0b1cc618122f310121fbe67de6babeb34719c8a  /xqrepack/ubinize.sh" >> /xqrepack/checksums.txt && \
    sha256sum -c /xqrepack/checksums.txt && \
    chmod a+x /xqrepack/*.sh

# Copy data for add-on
COPY run.sh /
RUN chmod a+x /run.sh
CMD [ "/run.sh" ]

# Health check - use pgrep -f to match script name in process args
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD pgrep -f "/run.sh" >/dev/null || exit 1

# Labels
LABEL org.opencontainers.image.title="xqrepack"
LABEL org.opencontainers.image.description="These scripts allow you to modify the different Xiaomi router firmware images to make sure SSH and UART access is always enabled. (Unsupported)"
LABEL org.opencontainers.image.vendor="FaserF's Home Assistant Add-ons"
LABEL org.opencontainers.image.authors="FaserF <https://github.com/FaserF>"
LABEL org.opencontainers.image.licenses="MIT"
LABEL org.opencontainers.image.url="https://github.com/FaserF/hassio-addons/tree/master/.unsupported/xqrepack"
LABEL org.opencontainers.image.source="https://github.com/FaserF/hassio-addons/tree/master/.unsupported/xqrepack"
LABEL org.opencontainers.image.documentation="https://github.com/FaserF/hassio-addons/blob/master/.unsupported/xqrepack/README.md"
LABEL org.opencontainers.image.created="${BUILD_DATE}"
