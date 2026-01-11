# https://developers.home-assistant.io/docs/add-ons/configuration#add-on-dockerfile
ARG BUILD_FROM=ghcr.io/hassio-addons/debian-base:9.1.0 # hadolint ignore=DL3008
# hadolint ignore=DL3006
FROM ${BUILD_FROM}

# renovate: datasource=github-releases depName=Eidolf/Docker-AntiGravity versioning=loose
ARG ANTIGRAVITY_VERSION="2025.12.0-nightly.20251226.1451"
ENV ANTIGRAVITY_VERSION=${ANTIGRAVITY_VERSION}
ARG LAZYGIT_VERSION=0.40.2
ARG BUILD_DATE="1970-01-01T00:00:00Z"

# Set shell
SHELL ["/bin/bash", "-o", "pipefail", "-c"]

# Install dependencies for NoVNC and VNC server
# Install dependencies and tools



# Addon metadata (injected by CI)
ENV ADDON_VERSION="1.0.1"
ENV ADDON_NAME="Antigravity-Server"
ENV ADDON_SLUG="antigravity-server"
ENV ADDON_UNSUPPORTED="false"

# hadolint ignore=DL3008,SC1091
RUN \
    apt-get update \
    && apt-get install -y --no-install-recommends \
        ca-certificates \
        gnupg \
        lsb-release \
        curl \
        wget \
        git \
        sudo \
        net-tools \
        dbus-x11 \
        dirmngr \
        apt-transport-https \
        \
        # XFCE & VNC
        xfce4 \
        xfce4-terminal \
        xfce4-goodies \
        tigervnc-standalone-server \
        tigervnc-common \
        tigervnc-tools \
        novnc \
        websockify \
        nginx \
        fonts-noto \
        fonts-noto-color-emoji \
        \
        # Python
        python3 \
        python3-pip \
        python3-numpy \
        python3-venv \
    \
    # Install Node.js v22
    && curl -fsSL https://deb.nodesource.com/setup_22.x | bash - \
    && apt-get install -y --no-install-recommends nodejs \
    \
    # Install Google Chrome Stable
    && curl -fsSL https://dl.google.com/linux/linux_signing_key.pub | gpg --dearmor -o /usr/share/keyrings/google-chrome.gpg \
    && echo "deb [arch=amd64 signed-by=/usr/share/keyrings/google-chrome.gpg] http://dl.google.com/linux/chrome/deb/ stable main" > /etc/apt/sources.list.d/google-chrome.list \
    && apt-get update && apt-get install -y --no-install-recommends google-chrome-stable \
    \
    # Install Docker CLI (Adapted for Debian)
    && install -m 0755 -d /etc/apt/keyrings \
    && curl -fsSL https://download.docker.com/linux/debian/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg \
    && chmod a+r /etc/apt/keyrings/docker.gpg \
    && echo \
    "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/debian \
    $(. /etc/os-release && echo "$VERSION_CODENAME") stable" > /etc/apt/sources.list.d/docker.list \
    && apt-get update && apt-get install -y --no-install-recommends docker-ce-cli docker-compose-plugin \
    \
    # Install Google AntiGravity
    && curl -fsSL https://us-central1-apt.pkg.dev/doc/repo-signing-key.gpg | gpg --dearmor --yes -o /etc/apt/keyrings/antigravity-repo-key.gpg \
    && echo "deb [signed-by=/etc/apt/keyrings/antigravity-repo-key.gpg] https://us-central1-apt.pkg.dev/projects/antigravity-auto-updater-dev/ antigravity-debian main" > /etc/apt/sources.list.d/antigravity.list \
    && apt-get update && apt-get install -y --no-install-recommends antigravity \
    \
    # Install LazyGit
    && curl -Lo lazygit.tar.gz "https://github.com/jesseduffield/lazygit/releases/download/v${LAZYGIT_VERSION}/lazygit_${LAZYGIT_VERSION}_Linux_x86_64.tar.gz" \
    && tar xf lazygit.tar.gz lazygit \
    && install lazygit /usr/local/bin \
    && rm lazygit.tar.gz lazygit \
    \
    # Cleanup
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/* \
    && mkdir -p /run/nginx /root/.vnc

# Setup NoVNC
RUN ln -sf /usr/share/novnc/vnc_lite.html /usr/share/novnc/index.html

# Copy S6-Overlay services
COPY rootfs /
RUN chmod -R +x /etc/s6-overlay/s6-rc.d/

# Healthcheck - verify NoVNC is responding
HEALTHCHECK --interval=60s --timeout=10s --start-period=120s --retries=3 \
    CMD curl --fail http://127.0.0.1:6080/ || exit 1

# Labels
LABEL org.opencontainers.image.title="Antigravity-Server"
LABEL org.opencontainers.image.description="Stream the Antigravity AI IDE (Linux Desktop with XFCE4) via NoVNC in your browser."
LABEL org.opencontainers.image.vendor="FaserF's Home Assistant Add-ons"
LABEL org.opencontainers.image.authors="FaserF <https://github.com/FaserF>"
LABEL org.opencontainers.image.licenses="MIT"
LABEL org.opencontainers.image.url="https://github.com/FaserF/hassio-addons/tree/master/antigravity-server"
LABEL org.opencontainers.image.source="https://github.com/FaserF/hassio-addons/tree/master/antigravity-server"
LABEL org.opencontainers.image.documentation="https://github.com/FaserF/hassio-addons/blob/master/antigravity-server/README.md"
LABEL org.opencontainers.image.created="${BUILD_DATE}"
LABEL org.opencontainers.image.version="${ANTIGRAVITY_VERSION}"
