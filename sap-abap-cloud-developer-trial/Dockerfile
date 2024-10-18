ARG BUILD_FROM=sapse/abap-cloud-developer-trial:ABAPTRIAL_2022
# hadolint ignore=DL3006
FROM ${BUILD_FROM}

# Copy data for add-on
COPY run.sh /
RUN chmod a+x /run.sh
CMD [ "/run.sh" ]
