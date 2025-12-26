ARG BUILD_FROM=ghcr.io/hassio-addons/base:19.0.0
# hadolint ignore=DL3006
FROM ${BUILD_FROM}
ENV PIP_BREAK_SYSTEM_PACKAGES=1
ARG BUILD_DATE="unknown"

# hadolint ignore=DL3018,DL3013,DL3042
RUN apk add --no-cache \
    wget lzo-dev mtd-utils-ubi squashfs-tools fakeroot make g++ coreutils python3 python3-dev py3-pip && \
    pip install python-lzo ubi_reader && \
    mkdir /xqrepack && \
    wget -q -O /xqrepack/repack-squashfs.sh https://raw.githubusercontent.com/geekman/xqrepack/master/repack-squashfs.sh && \
    wget -q -O /xqrepack/ubinize.sh https://raw.githubusercontent.com/geekman/xqrepack/master/ubinize.sh
#RUN wget -O /xqrepack/xqflash https://raw.githubusercontent.com/geekman/xqrepack/master/xqflash

# Copy data for add-on
COPY run.sh /
RUN chmod a+x /run.sh
CMD [ "/run.sh" ]

# Health check - verify run.sh is the main process
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD pgrep -x run.sh >/dev/null || exit 1

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
