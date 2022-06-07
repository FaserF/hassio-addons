ARG BUILD_FROM=ghcr.io/hassio-addons/base/amd64:12.0.0
# hadolint ignore=DL3006
FROM ${BUILD_FROM}
ENV LANG C.UTF-8

# Install requirements for add-on
RUN apk -U --no-cache add libpcap-dev
RUN apk -U --no-cache add libuv-dev
RUN apk -U --no-cache add git
RUN apk -U --no-cache add g++
RUN apk -U --no-cache add cmake
RUN apk -U --no-cache add nano
RUN apk -U --no-cache add screen
RUN apk -U --no-cache add build-base

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