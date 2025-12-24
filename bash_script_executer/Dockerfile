ARG BUILD_FROM
ARG BUILD_DATE
# hadolint ignore=DL3006
FROM ${BUILD_FROM}

# Create directory for apache2 to store PID file
RUN mkdir /run/apache2

# hadolint ignore=DL3018
RUN apk --no-cache add busybox-extras curl grep coreutils sed xmlstarlet bash

# Copy data for add-on
COPY run.sh /
RUN chmod a+x /run.sh
CMD [ "/run.sh" ]

# Labels
LABEL org.opencontainers.image.title="Bash Script Executer"
LABEL org.opencontainers.image.description="Execute your own bash scripts inside this Homeassistant Addon environment."
LABEL org.opencontainers.image.vendor="FaserF's Home Assistant Add-ons"
LABEL org.opencontainers.image.authors="FaserF <https://github.com/FaserF>"
LABEL org.opencontainers.image.licenses="MIT"
LABEL org.opencontainers.image.url="https://github.com/FaserF/hassio-addons/tree/master/bash_script_executer"
LABEL org.opencontainers.image.source="https://github.com/FaserF/hassio-addons/tree/master/bash_script_executer"
LABEL org.opencontainers.image.documentation="https://github.com/FaserF/hassio-addons/blob/master/bash_script_executer/README.md"
LABEL org.opencontainers.image.created="${BUILD_DATE}"
