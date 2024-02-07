ARG BUILD_FROM=ghcr.io/hassio-addons/base-python:13.1.1
# hadolint ignore=DL3006
FROM ${BUILD_FROM}

RUN mkdir /application

RUN apk add --no-cache tzdata bluez bluez-libs sudo bluez-deprecated
RUN apk add --no-cache --virtual build-dependencies git bluez-dev musl-dev make gcc glib-dev musl-dev
RUN apk add --no-cache --update wget unzip
RUN wget https://github.com/zewelor/bt-mqtt-gateway/archive/refs/heads/master.zip
RUN unzip -d /tmp/ master.zip \
&& rm -r master.zip \
&& cp -r /tmp/bt-mqtt-gateway-master/* /application
# Prepare venv
RUN python3 -m venv venv

# Install pip modules
RUN source ./venv/bin/activate \
&& cd /application \
&& apk add --no-cache py3-pip \
&& pip install --no-cache-dir -r requirements.txt \
&& pip install --no-cache-dir `./gateway.py -r all`

RUN apk del build-dependencies wget unzip

#COPY /tmp/bt-mqtt-gateway-master/* /application

# Copy data for add-on
COPY start.sh /
RUN chmod a+x /start.sh

CMD [ "/start.sh" ]