ARG BUILD_FROM=ghcr.io/hassio-addons/base-python:12.0.2
# hadolint ignore=DL3006
FROM ${BUILD_FROM}

# Set shell
SHELL ["/bin/bash", "-o", "pipefail", "-c"]

# Setup base
# hadolint ignore=DL3003
RUN apk add --no-cache wget unzip sed py3-pip
RUN pip install python-tado

RUN wget https://github.com/adrianslabu/tado_aa/archive/refs/heads/main.zip
RUN unzip main.zip && rm main.zip && cp tado_aa-main/tado_aa.py / && rm -r tado_aa-main

RUN apk del --purge wget unzip

# Copy data for add-on
COPY run.sh /
#COPY config.yml /wiki/
RUN chmod a+x /run.sh
RUN chmod a+x /tado_aa.py
CMD [ "/run.sh" ]
