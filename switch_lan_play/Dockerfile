ARG BUILD_FROM
# hadolint ignore=DL3006
FROM ${BUILD_FROM}

# Install requirements for add-on
# hadolint ignore=DL3018
RUN apk -U --no-cache add \
    libpcap-dev \
    libuv-dev \
    git \
    g++ \
    cmake \
    nano \
    screen \
    build-base

#Install SLP Client
RUN git clone https://github.com/spacemeowx2/switch-lan-play.git \
    && cd switch-lan-play \
    && mkdir build \
    && cd build \
    && cmake .. \
    && make \
    && cd src \
    && chmod +x lan-play \
    && cp lan-play /

# Copy data for add-on
COPY run.sh /
RUN chmod a+x /run.sh

CMD [ "/run.sh" ]