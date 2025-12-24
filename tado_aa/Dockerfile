ARG BUILD_FROM
# hadolint ignore=DL3006
FROM ${BUILD_FROM}
ENV PIP_BREAK_SYSTEM_PACKAGES=1

ARG BUILD_DATE

# Set shell
SHELL ["/bin/bash", "-o", "pipefail", "-c"]

# Setup base
# hadolint ignore=DL3003
RUN apk add --no-cache \
    curl=8.11.1-r0 \
    sed=4.9-r2

# Download and patch tado_aa.py to use environment variables
# Latest commit from adrianslabu/tado_aa (archived repo)
ENV PIP_BREAK_SYSTEM_PACKAGES=1
# renovate: datasource=github-tags depName=adrianslabu/tado_aa
ARG TADO_AA_SHA="d5bfc32389d34208e983422e11a3648eb11e25e9"
RUN curl -fsSL "https://raw.githubusercontent.com/adrianslabu/tado_aa/${TADO_AA_SHA}/tado_aa.py" -o /tado_aa.py && \
    sed -i "s|TOKEN_FILE = \"refresh_token\"|TOKEN_FILE = \"/data/refresh_token\"|g" /tado_aa.py && \
    sed -i "s|checkingInterval = 10.0|checkingInterval = float(os.getenv(\"TADO_CHECK_INTERVAL\", \"10.0\"))|g" /tado_aa.py && \
    sed -i "s|errorRetryingInterval = 30.0|errorRetryingInterval = float(os.getenv(\"TADO_RETRY_INTERVAL\", \"30.0\"))|g" /tado_aa.py && \
    sed -i "s|minTemp = 5|minTemp = int(os.getenv(\"TADO_MIN_TEMP\", \"5\"))|g" /tado_aa.py && \
    sed -i "s|maxTemp = 25|maxTemp = int(os.getenv(\"TADO_MAX_TEMP\", \"25\"))|g" /tado_aa.py && \
    sed -i "s|enableTempLimit = True|enableTempLimit = os.getenv(\"TADO_ENABLE_TEMP_LIMIT\", \"True\").lower() == \"true\"|g" /tado_aa.py && \
    sed -i "s|saveLog = False|saveLog = os.getenv(\"TADO_SAVE_LOG\", \"False\").lower() == \"true\"|g" /tado_aa.py && \
    sed -i "s|t = Tado(token_file_path=TOKEN_FILE)|username=os.getenv(\"TADO_USERNAME\"); password=os.getenv(\"TADO_PASSWORD\"); t=Tado(username, password, token_file_path=TOKEN_FILE) if (username and password) else Tado(token_file_path=TOKEN_FILE)|g" /tado_aa.py

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
