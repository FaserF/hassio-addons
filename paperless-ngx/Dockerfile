ARG BUILD_FROM
FROM $BUILD_FROM

# Set shell
SHELL ["/bin/bash", "-o", "pipefail", "-c"]

# Setup Environment
ENV \
    LANG="C.UTF-8" \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PIP_NO_CACHE_DIR=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

# Install Alpine dependencies
# hadolint ignore=DL3018,DL3013

# hadolint ignore=DL3013

# hadolint ignore=DL3013

# Addon metadata (injected by CI)
ENV ADDON_VERSION="0.0.3"
ENV ADDON_NAME="Paperless-ngx"
ENV ADDON_SLUG="paperless-ngx"
ENV ADDON_UNSUPPORTED="false"

RUN \
    apk add libssl3 libcrypto3 --no-cache -u \
        build-base \
        curl \
        file \
        git \
        ghostscript \
        gnupg \
        imagemagick \
        jq \
        libffi-dev \
        libmagic \
        libpq-dev \
        libxml2-dev \
        libxslt-dev \
        mariadb-dev \
        postgresql-client \
        python3 \
        python3-dev \
        py3-pip \
        py3-scipy \
        py3-numpy \
        py3-pillow \
        py3-mysqlclient \
        py3-psycopg2 \
        tesseract-ocr \
        tesseract-ocr-data-deu \
        tesseract-ocr-data-eng \
        unpaper \
        poppler-utils \
        7zip \
        redis \
        sudo \
        zlib-dev \
        jpeg-dev \
        openjpeg-dev \
        tiff-dev \
        freetype-dev \
        lcms2-dev \
        libwebp-dev \
        tcl-dev \
        tk-dev \
        harfbuzz-dev \
        fribidi-dev \
        xcb-util-image-dev \
    && pip3 install --no-cache-dir --upgrade pip

# Arguments
ARG PAPERLESS_VERSION

# Install Paperless-ngx
WORKDIR /usr/src/paperless
# hadolint ignore=DL3013
RUN \
    curl -J -L -o paperless.tar.xz \
        "https://github.com/paperless-ngx/paperless-ngx/releases/download/v${PAPERLESS_VERSION}/paperless-ngx-v${PAPERLESS_VERSION}.tar.xz" \
    && 7z x paperless.tar.xz \
    && 7z x paperless.tar -o/usr/src/paperless \
    && rm paperless.tar.xz paperless.tar \
    && mv paperless-ngx/* . \
    && rm -rf paperless-ngx \
    && pip3 install --no-cache-dir -r requirements.txt \
    && pip3 install --no-cache-dir \
        gunicorn \
        uvicorn \
    # Cleanup
    && apk del --no-cache \
        build-base \
        python3-dev \
        libffi-dev \
        libxml2-dev \
        libxslt-dev \
        zlib-dev \
        jpeg-dev \
        openjpeg-dev \
        tiff-dev \
        freetype-dev \
        lcms2-dev \
        libwebp-dev \
        tcl-dev \
        tk-dev \
        harfbuzz-dev \
        fribidi-dev \
        xcb-util-image-dev \
        mariadb-dev \
        libpq-dev \
    && (find /usr/lib/python3* -name '__pycache__' -exec rm -rf {} + || true)

# Copy root filesystem
COPY rootfs /

# Build arguments
ARG BUILD_ARCH
ARG BUILD_DATE="1970-01-01T00:00:00Z"
ARG BUILD_DESCRIPTION
ARG BUILD_NAME
ARG BUILD_REF
ARG BUILD_REPOSITORY
ARG BUILD_VERSION

# Labels
LABEL \
    io.hass.name="${BUILD_NAME}" \
    io.hass.description="${BUILD_DESCRIPTION}" \
    io.hass.arch="${BUILD_ARCH}" \
    io.hass.type="addon" \
    io.hass.version="${BUILD_VERSION}" \
    maintainer="FaserF <https://github.com/FaserF>" \
    org.opencontainers.image.title="${BUILD_NAME}" \
    org.opencontainers.image.description="${BUILD_DESCRIPTION}" \
    org.opencontainers.image.vendor="FaserF's Home Assistant Add-ons" \
    org.opencontainers.image.authors="FaserF <https://github.com/FaserF>" \
    org.opencontainers.image.licenses="MIT" \
    org.opencontainers.image.url="https://github.com/FaserF/hassio-addons" \
    org.opencontainers.image.source="https://github.com/FaserF/hassio-addons" \
    org.opencontainers.image.documentation="https://github.com/FaserF/hassio-addons/blob/master/paperless-ngx/README.md" \
    org.opencontainers.image.created="${BUILD_DATE}" \
    org.opencontainers.image.revision="${BUILD_REF}" \
    org.opencontainers.image.version="${BUILD_VERSION}"

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=90s --retries=5 \
    CMD curl -fsS http://127.0.0.1:8000/ || exit 1

RUN chmod a+x /etc/s6-overlay/s6-rc.d/*/run /etc/s6-overlay/s6-rc.d/*/up /etc/s6-overlay/s6-rc.d/*/down || true
