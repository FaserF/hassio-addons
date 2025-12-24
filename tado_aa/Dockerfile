ARG BUILD_FROM
# hadolint ignore=DL3006
FROM ${BUILD_FROM}

# Set shell
SHELL ["/bin/bash", "-o", "pipefail", "-c"]

# Setup base
# hadolint ignore=DL3003,DL3018
RUN apk add --no-cache wget unzip sed py3-pip

# Prepare venv
RUN python3 -m venv venv

# Install python-tado via pip
RUN source ./venv/bin/activate && \
    pip install python-tado==0.19.2

RUN wget https://github.com/adrianslabu/tado_aa/archive/refs/heads/main.zip
RUN unzip main.zip && rm main.zip && cp tado_aa-main/tado_aa.py / && rm -r tado_aa-main

RUN apk del --purge wget unzip

# Copy data for add-on
COPY run.sh /
#COPY config.yml /wiki/
RUN chmod a+x /run.sh
RUN chmod a+x /tado_aa.py
CMD [ "/run.sh" ]

# Labels
LABEL org.opencontainers.image.title="Tado Auto Assist"
LABEL org.opencontainers.image.description="Tado Auto-Assist for Geofencing and open Window detection"
LABEL org.opencontainers.image.vendor="FaserF's Home Assistant Add-ons"
LABEL org.opencontainers.image.authors="FaserF <https://github.com/FaserF>"
LABEL org.opencontainers.image.licenses="MIT"
LABEL org.opencontainers.image.url="https://github.com/FaserF/hassio-addons/tree/master/tado_aa"
LABEL org.opencontainers.image.source="https://github.com/FaserF/hassio-addons/tree/master/tado_aa"
LABEL org.opencontainers.image.documentation="https://github.com/FaserF/hassio-addons/tree/master/tado_aa/blob/master/tado_aa/README.md"
LABEL org.opencontainers.image.created="2025-12-24"
