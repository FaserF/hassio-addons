ARG BUILD_FROM
FROM ${BUILD_FROM}

# Setup Environment
ENV LANG C.UTF-8
ENV PIP_ROOT_USER_ACTION=ignore
ENV PIP_BREAK_SYSTEM_PACKAGES=1

# Install System Requirements
RUN \
    apk add --no-cache \
    nodejs \
    npm \
    postgresql \
    postgresql-dev \
    nginx \
    gcc \
    musl-dev \
    libffi-dev \
    git \
    curl \
    python3 \
    py3-pip

# --- NGINX SETUP ---
COPY nginx.conf /etc/nginx/http.d/default.conf

# --- RUN SCRIPT ---
COPY run.sh /run.sh
RUN chmod a+x /run.sh

CMD [ "/run.sh" ]
