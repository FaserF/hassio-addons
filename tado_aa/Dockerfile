ARG BUILD_FROM=ghcr.io/hassio-addons/base:19.0.0
# hadolint ignore=DL3006
FROM ${BUILD_FROM}
ENV PIP_BREAK_SYSTEM_PACKAGES=1

ARG BUILD_DATE

# Set shell
SHELL ["/bin/bash", "-o", "pipefail", "-c"]

# Setup base
# hadolint ignore=DL3003,DL3018
RUN apk add --no-cache \
    curl

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
# hadolint ignore=DL3042,SC1091
RUN source ./venv/bin/activate && \
    pip install --no-cache-dir python-tado==0.19.2

# Copy data for add-on
COPY run.sh /
RUN chmod a+x /run.sh \
    && chmod a+x /tado_aa.py
# Healthcheck
HEALTHCHECK \
    CMD pgrep -f "python3.*tado_aa.py" || exit 1

CMD [ "/run.sh" ]

# Labels
LABEL org.opencontainers.image.title="Tado Auto Assist"
LABEL org.opencontainers.image.description="Tado Auto-Assist for Geofencing and open Window detection"
LABEL org.opencontainers.image.vendor="FaserF's Home Assistant Add-ons"
LABEL org.opencontainers.image.authors="FaserF <https://github.com/FaserF>"
LABEL org.opencontainers.image.licenses="MIT"
LABEL org.opencontainers.image.url="https://github.com/FaserF/hassio-addons/tree/master/tado_aa"
LABEL org.opencontainers.image.source="https://github.com/FaserF/hassio-addons/tree/master/tado_aa"
LABEL org.opencontainers.image.documentation="https://github.com/FaserF/hassio-addons/blob/master/tado_aa/README.md"
LABEL org.opencontainers.image.created="${BUILD_DATE}"
