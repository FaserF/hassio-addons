# https://developers.home-assistant.io/docs/add-ons/configuration#add-on-dockerfile
ARG BUILD_FROM=ghcr.io/hassio-addons/debian-base:9.3.0
# hadolint ignore=DL3006
FROM ${BUILD_FROM}

# renovate: datasource=github-releases depName=Eidolf/Docker-AntiGravity versioning=loose
ARG ANTIGRAVITY_VERSION="2026.4.1"
ENV ANTIGRAVITY_VERSION=${ANTIGRAVITY_VERSION}
ARG LAZYGIT_VERSION=0.40.2
ARG BUILD_DATE="1970-01-01T00:00:00Z"

# Set shell and ENV
SHELL ["/bin/bash", "-o", "pipefail", "-c"]
ENV DEBIAN_FRONTEND=noninteractive

# Layer 1: Core System Tools & VNC Setup

# App metadata (injected by CI)
ENV APP_VERSION="1.2.2"
ENV APP_NAME="Antigravity-Server"
ENV APP_SLUG="antigravity-server"
ENV APP_UNSUPPORTED="false"

RUN apt-get update && apt-get install -y --no-install-recommends \
        ca-certificates \
        gnupg \
        lsb-release \
        curl \
        wget \
        sudo \
        git \
        net-tools \
        dbus-x11 \
        wmctrl \
        dirmngr \
        apt-transport-https \
        tigervnc-standalone-server \
        tigervnc-common \
        tigervnc-tools \
        novnc \
        websockify \
        nginx \
        autocutsel \
        ripgrep \
        fd-find \
        zip \
        unzip \
        jq \
        gosu \
        iptables \
        fuse-overlayfs \
        build-essential \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

# Layer 2: Minimal XFCE Desktop
RUN apt-get update && apt-get install -y --no-install-recommends \
        xfce4-session \
        xfce4-panel \
        xfce4-settings \
        xfwm4 \
        xfdesktop4 \
        xfce4-terminal \
        xfce4-clipman-plugin \
        xfce4-notifyd \
        xfce4-taskmanager \
        gnome-keyring \
        libsecret-1-0 \
        hicolor-icon-theme \
        adwaita-icon-theme \
        fonts-noto \
        fonts-noto-color-emoji \
        xfce4-appfinder \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

# Layer 3: Node.js (v24.x) and Python 3.13
RUN curl -fsSL https://deb.nodesource.com/setup_24.x | bash - && \
    apt-get update && apt-get install -y --no-install-recommends \
        nodejs \
        python3.13 \
        python3.13-venv \
        python3.13-dev \
    && update-alternatives --install /usr/bin/python3 python3 /usr/bin/python3.13 1 \
    && curl -fsSL https://bootstrap.pypa.io/get-pip.py | python3.13 - --break-system-packages \
    && python3 -m pip install --no-cache-dir --ignore-installed \
        websockify==0.11.0 \
        --break-system-packages \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

# Layer 4: Browsers & Docker CLI (Debian-specific paths)
# hadolint ignore=SC2016
RUN ARCH=$(dpkg --print-architecture) && \
    if [ "$ARCH" = "amd64" ]; then \
        curl -fsSL https://dl.google.com/linux/linux_signing_key.pub | gpg --dearmor -o /usr/share/keyrings/google-chrome.gpg && \
        echo "deb [arch=amd64 signed-by=/usr/share/keyrings/google-chrome.gpg] http://dl.google.com/linux/chrome/deb/ stable main" > /etc/apt/sources.list.d/google-chrome.list && \
        apt-get update && apt-get install -y --no-install-recommends google-chrome-stable && \
        # Create a wrapper for Chrome to run with --no-sandbox (required for root in HA)
        printf '#!/bin/bash\nexec /usr/bin/google-chrome-stable --no-sandbox --test-type --disable-dev-shm-usage --no-first-run --no-default-browser-check "$@"' > /usr/local/bin/google-chrome; \
    else \
        apt-get update && apt-get install -y --no-install-recommends chromium && \
        # Create a wrapper for Chromium
        printf '#!/bin/bash\nexec /usr/bin/chromium --no-sandbox --test-type --disable-dev-shm-usage --no-first-run --no-default-browser-check "$@"' > /usr/local/bin/google-chrome; \
    fi && \
    chmod +x /usr/local/bin/google-chrome && \
    ln -sf /usr/local/bin/google-chrome /usr/local/bin/google-chrome-stable && \
    # Fix Chrome password store to basic to avoid keyring prompts in VNC
    if [ -f /opt/google/chrome/google-chrome ]; then \
        sed -i 's/exec -a "$0" "$HERE\/chrome" "$@"/exec -a "$0" "$HERE\/chrome" --password-store=basic "$@"/' /opt/google/chrome/google-chrome; \
    fi && \
    update-alternatives --install /usr/bin/x-www-browser x-www-browser /usr/local/bin/google-chrome 100 && \
    update-alternatives --install /usr/bin/gnome-www-browser gnome-www-browser /usr/local/bin/google-chrome 100 && \
    install -m 0755 -d /etc/apt/keyrings && \
    curl -fsSL https://download.docker.com/linux/debian/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg && \
    chmod a+r /etc/apt/keyrings/docker.gpg && \
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/debian $(. /etc/os-release && echo "$VERSION_CODENAME") stable" > /etc/apt/sources.list.d/docker.list && \
    apt-get update && apt-get install -y --no-install-recommends docker-ce-cli docker-compose-plugin && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

# Layer 5: AntiGravity & LazyGit
RUN curl -fsSL https://us-central1-apt.pkg.dev/doc/repo-signing-key.gpg | gpg --dearmor --yes -o /etc/apt/keyrings/antigravity-repo-key.gpg && \
    echo "deb [signed-by=/etc/apt/keyrings/antigravity-repo-key.gpg] https://us-central1-apt.pkg.dev/projects/antigravity-auto-updater-dev/ antigravity-debian main" > /etc/apt/sources.list.d/antigravity.list && \
    apt-get update && apt-get install -y --no-install-recommends antigravity && \
    ARCH_LG=$(dpkg --print-architecture | sed 's/amd64/x86_64/') && \
    curl -Lo lazygit.tar.gz "https://github.com/jesseduffield/lazygit/releases/download/v${LAZYGIT_VERSION}/lazygit_${LAZYGIT_VERSION}_Linux_${ARCH_LG}.tar.gz" && \
    tar xf lazygit.tar.gz lazygit && \
    install lazygit /usr/local/bin && \
    rm lazygit.tar.gz lazygit && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

# Final Setup: User, Claude Code, and permissions
RUN (id -u ubuntu >/dev/null 2>&1 && userdel -f ubuntu || true) && \
    (getent group ubuntu >/dev/null 2>&1 && groupdel ubuntu || true) && \
    groupadd -g 1000 dev && \
    useradd -u 1000 -g dev -m -s /bin/bash dev && \
    echo "dev ALL=(ALL) NOPASSWD:ALL" >> /etc/sudoers && \
    (getent group docker || groupadd docker) && \
    usermod -aG docker dev && \
    mkdir -p /home/dev/.vnc && \
    chown -R dev:dev /home/dev
# Setup paths and environment
RUN mkdir -p /run/nginx /root/.vnc /root/.config/tigervnc && \
    ln -sf "$(which fdfind)" /usr/local/bin/fd && \
    ln -sf /usr/share/novnc/vnc_lite.html /usr/share/novnc/index.html

# Copy S6-Overlay services
COPY rootfs /
RUN chmod -R +x /etc/s6-overlay/s6-rc.d/

# Healthcheck - verify NoVNC is responding
HEALTHCHECK --interval=60s --timeout=10s --start-period=120s --retries=3 \
    CMD curl --fail http://127.0.0.1:6080/ || exit 1

# Labels
LABEL org.opencontainers.image.title="Antigravity-Server"
LABEL org.opencontainers.image.description="Stream the Antigravity AI IDE (Linux Desktop with XFCE4) via NoVNC in your browser."
LABEL org.opencontainers.image.vendor="FaserF's Home Assistant Apps"
LABEL org.opencontainers.image.authors="FaserF <https://github.com/FaserF>"
LABEL org.opencontainers.image.licenses="MIT"
LABEL org.opencontainers.image.url="https://github.com/FaserF/hassio-addons/tree/master/antigravity-server"
LABEL org.opencontainers.image.source="https://github.com/FaserF/hassio-addons/tree/master/antigravity-server"
LABEL org.opencontainers.image.documentation="https://github.com/FaserF/hassio-addons/blob/master/antigravity-server/README.md"
LABEL org.opencontainers.image.created="${BUILD_DATE}"
LABEL org.opencontainers.image.version="${ANTIGRAVITY_VERSION}"
