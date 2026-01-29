# Multi-stage build: Use HA debian-base for S6/Bashio, pull SAP runtime from SAP image
# renovate: datasource=docker depName=ghcr.io/hassio-addons/debian-base
ARG BUILD_FROM=ghcr.io/hassio-addons/debian-base:9.1.0
# renovate: datasource=docker depName=sapse/abap-cloud-developer-trial
ARG SAP_IMAGE=sapse/abap-cloud-developer-trial:2023
# hadolint ignore=DL3006
FROM ${SAP_IMAGE} AS sap-source

# Main build stage - HA debian-base with S6/Bashio
# hadolint ignore=DL3006
FROM ${BUILD_FROM}
ARG BUILD_DATE="unknown"

# Set shell
SHELL ["/bin/bash", "-o", "pipefail", "-c"]

# Install SAP dependencies

# hadolint ignore=DL3008
# DL3008 ignored: We intentionally don't pin package versions to ensure
# security updates are applied when the image is rebuilt. Reproducibility is less
# critical here as the SAP runtime is already pinned via the base image.



# Addon metadata (injected by CI)
ENV ADDON_VERSION="0.1.1"
ENV ADDON_NAME="SAP ABAP Cloud Developer Trial"
ENV ADDON_SLUG="sap-abap-cloud-dev"
ENV ADDON_UNSUPPORTED="false"

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        ca-certificates \
        curl \
        wget \
        xz-utils \
        jq \
        procps \
        libaio1t64 \
        libatomic1 \
        libnuma1 \
        libstdc++6 \
        netcat-openbsd \
        uuid-runtime \
        hostname \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Copy SAP runtime from the official SAP image
# This includes the full SAP HANA + ABAP Platform installation
COPY --from=sap-source /opt/sap /opt/sap/
COPY --from=sap-source /hana /hana/
COPY --from=sap-source /sybase /sybase/
COPY --from=sap-source /usr/local/bin/startup.sh /usr/local/bin/startup.sh
COPY --from=sap-source /etc/passwd /tmp/sap_passwd
COPY --from=sap-source /etc/group /tmp/sap_group

# Create required SAP users and groups (merge from SAP image)
RUN grep sapsys /tmp/sap_group >> /etc/group 2>/dev/null || groupadd -g 1001 sapsys \
    && grep a4hadm /tmp/sap_passwd >> /etc/passwd 2>/dev/null || useradd -u 1001 -g sapsys -d /home/a4hadm -m -s /bin/bash a4hadm \
    && grep sapadm /tmp/sap_passwd >> /etc/passwd 2>/dev/null || useradd -u 1002 -g sapsys -d /home/sapadm -m -s /bin/bash sapadm \
    && rm -f /tmp/sap_passwd /tmp/sap_group \
    && mkdir -p /home/a4hadm /home/sapadm \
    && chown -R a4hadm:sapsys /home/a4hadm 2>/dev/null || true \
    && chown -R sapadm:sapsys /home/sapadm 2>/dev/null || true

# Copy rootfs (S6-RC service definitions)
COPY rootfs /

# Ensure scripts are executable
RUN find /etc/s6-overlay -type f -name "run" -exec chmod +x {} \; \
    && find /etc/s6-overlay -type f -name "finish" -exec chmod +x {} \; 2>/dev/null || true \
    && chmod +x /usr/local/bin/startup.sh 2>/dev/null || true

# Build arguments
ARG BUILD_ARCH
ARG BUILD_DESCRIPTION
ARG BUILD_NAME
ARG BUILD_REF
ARG BUILD_REPOSITORY
ARG BUILD_VERSION

# Home Assistant labels
LABEL \
    io.hass.name="${BUILD_NAME}" \
    io.hass.description="${BUILD_DESCRIPTION}" \
    io.hass.arch="${BUILD_ARCH}" \
    io.hass.type="addon" \
    io.hass.version="${BUILD_VERSION}" \
    maintainer="FaserF"

# OCI labels
LABEL \
    org.opencontainers.image.title="SAP ABAP Cloud Developer Trial" \
    org.opencontainers.image.description="SAP ABAP Platform Trial for local ABAP development - NO LICENSE PROVIDED" \
    org.opencontainers.image.vendor="FaserF's Home Assistant Add-ons" \
    org.opencontainers.image.authors="FaserF <https://github.com/FaserF>" \
    org.opencontainers.image.licenses="MIT" \
    org.opencontainers.image.url="https://github.com/FaserF/hassio-addons/tree/master/sap-abap-cloud-dev" \
    org.opencontainers.image.source="https://github.com/FaserF/hassio-addons/tree/master/sap-abap-cloud-dev" \
    org.opencontainers.image.documentation="https://github.com/FaserF/hassio-addons/blob/master/sap-abap-cloud-dev/README.md" \
    org.opencontainers.image.created="${BUILD_DATE}"

# Healthcheck - SAP takes a long time to start (5+ minutes)
HEALTHCHECK --interval=60s --timeout=30s --start-period=600s --retries=5 \
    CMD curl --fail -k https://127.0.0.1:8443/ || exit 1
