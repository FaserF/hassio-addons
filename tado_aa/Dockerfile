ARG BUILD_FROM
# hadolint ignore=DL3006
FROM ${BUILD_FROM}

# Set shell
SHELL ["/bin/bash", "-o", "pipefail", "-c"]

# Setup base
# hadolint ignore=DL3003
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
