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
RUN apk add --no-cache \
    wget lzo-dev mtd-utils-ubi squashfs-tools fakeroot make g++ coreutils python3 python3-dev py3-pip && \
    python3 -m venv $VIRTUAL_ENV && \
    pip install --no-cache-dir python-lzo ubi_reader && \
    mkdir /xqrepack && \
    wget -q -O /xqrepack/repack-squashfs.sh "https://raw.githubusercontent.com/geekman/xqrepack/${XQREPACK_RELEASE}/repack-squashfs.sh" && \
    wget -q -O /xqrepack/ubinize.sh "https://raw.githubusercontent.com/geekman/xqrepack/${XQREPACK_RELEASE}/ubinize.sh" && \
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
