ARG BUILD_FROM=ghcr.io/home-assistant/amd64-base-python:3.14-alpine3.21
# hadolint ignore=DL3006
FROM ${BUILD_FROM}
ENV PIP_BREAK_SYSTEM_PACKAGES=1

ARG BUILD_DATE="unknown"
# CR-Skip-PythonBaseCheck

# Set shell
SHELL ["/bin/bash", "-o", "pipefail", "-c"]

# Setup base
# hadolint ignore=DL3003,DL3018

# hadolint ignore=DL3018



# Addon metadata (injected by CI)
ENV ADDON_VERSION="2.1.1"
ENV ADDON_NAME="Tado Auto Assist"
ENV ADDON_SLUG="tado_aa"
ENV ADDON_UNSUPPORTED="false"

RUN apk add --no-cache curl

# Download and patch tado_aa.py to use environment variables
# Latest commit from adrianslabu/tado_aa (archived repo)
# renovate: datasource=github-commits depName=adrianslabu/tado_aa
ARG TADO_AA_SHA="d5bfc325462d6aa770707fb666882b1b4942bcc7"
RUN curl -fsSL "https://raw.githubusercontent.com/adrianslabu/tado_aa/${TADO_AA_SHA}/tado_aa.py" -o /tado_aa.py

# Patch the file
COPY patch.py /patch.py
RUN python3 /patch.py && rm /patch.py

# Prepare venv
RUN python3 -m venv venv

# Install python-tado via pip
# hadolint ignore=DL3042
ENV TADO_VERSION="0.19.2"
RUN ./venv/bin/pip install --no-cache-dir python-tado==${TADO_VERSION}

# Copy data for add-on
COPY run.sh /
RUN chmod a+x /run.sh \
    && chmod a+x /tado_aa.py
# Healthcheck
HEALTHCHECK --interval=30s --timeout=15s --start-period=15s --retries=3 \
    CMD pgrep -f "python3.*tado_aa.py" || exit 1

CMD [ "/run.sh" ]

# Labels
LABEL \
    org.opencontainers.image.title="Tado Auto Assist" \
    org.opencontainers.image.description="Tado Auto-Assist for Geofencing and open Window detection" \
    org.opencontainers.image.vendor="FaserF's Home Assistant Add-ons" \
    org.opencontainers.image.authors="FaserF <https://github.com/FaserF>" \
    org.opencontainers.image.licenses="MIT" \
    org.opencontainers.image.url="https://github.com/FaserF/hassio-addons/tree/master/tado_aa" \
    org.opencontainers.image.source="https://github.com/FaserF/hassio-addons/tree/master/tado_aa" \
    org.opencontainers.image.documentation="https://github.com/FaserF/hassio-addons/blob/master/tado_aa/README.md" \
    org.opencontainers.image.created="${BUILD_DATE}"
