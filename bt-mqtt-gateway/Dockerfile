ARG BUILD_FROM=ghcr.io/hassio-addons/base-python/amd64:9.0.1
FROM ${BUILD_FROM}

RUN mkdir /application

RUN apk add --no-cache tzdata bluez bluez-libs sudo bluez-deprecated                                  && \
    apk add --no-cache --virtual build-dependencies git bluez-dev musl-dev make gcc glib-dev musl-dev && \
    apk add --no-cache --update wget unzip                                                            && \
    wget https://github.com/zewelor/bt-mqtt-gateway/archive/refs/heads/master.zip                     && \
    unzip -d /tmp/ master.zip                                                                         && \
    rm -r master.zip                                                                                  && \
    cp -r /tmp/bt-mqtt-gateway-master/* /application                                                  && \
    cd /application                                                                                   && \
    pip install --no-cache-dir -r requirements.txt                                                    && \
    pip install --no-cache-dir `./gateway.py -r all`                                                  && \
    apk del build-dependencies wget unzip                                                             

#COPY /tmp/bt-mqtt-gateway-master/* /application

# Copy data for add-on
COPY start.sh /
RUN chmod a+x /start.sh

CMD [ "/start.sh" ]