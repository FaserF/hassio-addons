ARG BUILD_FROM
ARG BUILD_DATE
# hadolint ignore=DL3006
FROM ${BUILD_FROM}

# Create directory for apache2 to store PID file
# hadolint ignore=DL3018
RUN mkdir /run/apache2 \
    && apk --no-cache add busybox-extras curl grep coreutils sed xmlstarlet bash

# Copy data for add-on
COPY run.sh /

# Health check - verify run.sh process is running
HEALTHCHECK CMD pgrep -f run.sh >/dev/null || exit 1

RUN chmod a+x /run.sh
CMD [ "/run.sh" ]

# Labels
LABEL \
    org.opencontainers.image.title="Bash Script Executer" \
    org.opencontainers.image.description="Execute your own bash scripts inside this Homeassistant Addon environment." \
    org.opencontainers.image.vendor="FaserF's Home Assistant Add-ons" \
    org.opencontainers.image.authors="FaserF <https://github.com/FaserF>" \
    org.opencontainers.image.licenses="MIT" \
    org.opencontainers.image.url="https://github.com/FaserF/hassio-addons/tree/master/bash_script_executer" \
    org.opencontainers.image.source="https://github.com/FaserF/hassio-addons/tree/master/bash_script_executer" \
    org.opencontainers.image.documentation="https://github.com/FaserF/hassio-addons/blob/master/bash_script_executer/README.md" \
    org.opencontainers.image.created="${BUILD_DATE}"
