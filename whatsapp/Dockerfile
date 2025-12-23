ARG BUILD_FROM
FROM $BUILD_FROM

# Install requirements for add-on
RUN \
  apt-get update \
  && apt-get install -y --no-install-recommends \
    python3 \
    python3-pip \
    python3-venv \
    git \
  && rm -rf /var/lib/apt/lists/*

# Install Playwright and its dependencies
# We install globally or in a venv. For HA Addon, global is often simpler or managed via S6.
# Using --with-deps to install browser binaries and OS dependencies
RUN pip3 install playwright==1.49.0
RUN playwright install --with-deps chromium

WORKDIR /app

# Copy data for add-on
COPY app /app
COPY run.sh /

RUN pip3 install -r requirements.txt

RUN chmod a+x /run.sh

CMD [ "/run.sh" ]
